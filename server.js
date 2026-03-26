const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const compression = require('compression');
const { createClient } = require('redis');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// =================================================================
// CONFIGURAÇÕES DE SEGURANÇA
// =================================================================
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições, tente novamente em 15 minutos.' }
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sessão em memória (simples para Vercel)
app.use(session({
  secret: process.env.SESSION_SECRET || 'minha_chave_super_secreta_123456789',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// =================================================================
// CONFIGURAÇÃO DO REDIS
// =================================================================
let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://default:JyefUsxHJljfdvs8HACumEyLE7XNgLvG@redis-19242.c266.us-east-1-3.ec2.cloud.redislabs.com:19242'
    });
    
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    redisClient.on('connect', () => console.log('✅ Redis conectado!'));
    
    await redisClient.connect();
  }
  return redisClient;
}

// =================================================================
// CONFIGURAÇÃO DO EJS
// =================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para injetar config do site
app.use(async (req, res, next) => {
  try {
    const redis = await getRedisClient();
    let config = await redis.hgetall('site:config');
    
    if (!config || Object.keys(config).length === 0) {
      config = {
        title: process.env.SITE_TITLE || 'ModoDigital',
        description: process.env.SITE_DESCRIPTION || 'Dicas e tutoriais para sua vida digital',
        keywords: 'blog, tecnologia, marketing, produtividade',
        siteUrl: process.env.SITE_URL || 'https://blog-modo-digital.vercel.app'
      };
      await redis.hset('site:config', config);
    }
    
    res.locals.siteConfig = config;
    res.locals.currentUrl = `${config.siteUrl}${req.originalUrl}`;
    next();
  } catch (error) {
    console.error('Erro config:', error);
    res.locals.siteConfig = {
      title: 'ModoDigital',
      description: 'Dicas e tutoriais',
      siteUrl: 'https://blog-modo-digital.vercel.app'
    };
    next();
  }
});

// =================================================================
// FUNÇÕES DE ARTIGOS
// =================================================================
class ArticleService {
  static async createArticle(data) {
    const redis = await getRedisClient();
    const id = uuidv4();
    const slug = slugify(data.title, { lower: true, strict: true });
    const now = new Date().toISOString();
    
    const article = {
      id,
      slug,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt || data.content.substring(0, 160),
      coverImage: data.coverImage || 'https://picsum.photos/id/1/1200/630',
      coverAlt: data.coverAlt || data.title,
      author: data.author || 'Admin',
      category: data.category,
      tags: JSON.stringify(data.tags || []),
      metaTitle: data.metaTitle || data.title,
      metaDescription: data.metaDescription || data.excerpt,
      keywords: data.keywords || data.category,
      published: data.published !== false ? 'true' : 'false',
      createdAt: now,
      updatedAt: now,
      views: '0'
    };
    
    await redis.hset(`article:${slug}`, article);
    await redis.sadd('articles:all', slug);
    
    if (article.published === 'true') {
      await redis.zadd('articles:published', Date.now(), slug);
      await redis.sadd(`articles:category:${article.category}`, slug);
      if (data.tags) {
        for (const tag of data.tags) {
          await redis.sadd(`articles:tag:${tag}`, slug);
        }
      }
    }
    
    return article;
  }
  
  static async getArticle(slug) {
    const redis = await getRedisClient();
    const article = await redis.hgetall(`article:${slug}`);
    
    if (!article || Object.keys(article).length === 0) return null;
    
    const views = parseInt(article.views || '0') + 1;
    await redis.hset(`article:${slug}`, 'views', views.toString());
    await redis.zincrby('articles:views', 1, slug);
    
    return article;
  }
  
  static async listArticles(page = 1, limit = 10, category = null, search = null) {
    const redis = await getRedisClient();
    let slugs = [];
    
    if (category && category !== 'all') {
      slugs = await redis.smembers(`articles:category:${category}`);
    } else {
      slugs = await redis.zrevrange('articles:published', 0, -1);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      const filtered = [];
      for (const slug of slugs) {
        const article = await this.getArticle(slug);
        if (article && article.title && 
            (article.title.toLowerCase().includes(searchLower) || 
             (article.excerpt && article.excerpt.toLowerCase().includes(searchLower)))) {
          filtered.push(slug);
        }
      }
      slugs = filtered;
    }
    
    const start = (page - 1) * limit;
    const paginatedSlugs = slugs.slice(start, start + limit);
    
    const articles = [];
    for (const slug of paginatedSlugs) {
      const article = await this.getArticle(slug);
      if (article && article.published === 'true') {
        articles.push(article);
      }
    }
    
    return {
      articles,
      total: slugs.length,
      page,
      totalPages: Math.ceil(slugs.length / limit)
    };
  }
  
  static async getPopularArticles(limit = 5) {
    const redis = await getRedisClient();
    const slugs = await redis.zrevrange('articles:views', 0, limit - 1);
    const articles = [];
    
    for (const slug of slugs) {
      const article = await this.getArticle(slug);
      if (article) articles.push(article);
    }
    
    return articles;
  }
  
  static async getRelatedArticles(category, currentSlug, limit = 3) {
    const redis = await getRedisClient();
    const slugs = await redis.smembers(`articles:category:${category}`);
    const filtered = slugs.filter(slug => slug !== currentSlug).slice(0, limit);
    const articles = [];
    
    for (const slug of filtered) {
      const article = await this.getArticle(slug);
      if (article && article.published === 'true') articles.push(article);
    }
    
    return articles;
  }
}

// =================================================================
// ROTAS DO SITE
// =================================================================

// Homepage
app.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const category = req.query.categoria || null;
    const search = req.query.q || null;
    
    const { articles, total, totalPages } = await ArticleService.listArticles(page, 9, category, search);
    const popular = await ArticleService.getPopularArticles(5);
    
    // Criar views se não existirem
    const viewsPath = path.join(__dirname, 'views');
    const fs = require('fs');
    
    if (!fs.existsSync(`${viewsPath}/index.ejs`)) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>ModoDigital</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-gray-100">
          <div class="container mx-auto px-4 py-8">
            <h1 class="text-4xl font-bold text-blue-600">ModoDigital</h1>
            <p class="text-xl mt-2">Blog sobre tecnologia, marketing e produtividade</p>
            <p class="mt-4">Total de artigos: ${total}</p>
            <a href="/admin/login" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded">Admin</a>
            <a href="/redis-test" class="inline-block ml-4 bg-green-600 text-white px-4 py-2 rounded">Test Redis</a>
          </div>
        </body>
        </html>
      `);
    }
    
    res.render('index', {
      articles,
      popular,
      totalPages,
      currentPage: page,
      category,
      search,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(`<h1>Erro</h1><pre>${error.message}</pre>`);
  }
});

// Artigo individual
app.get('/artigo/:slug', async (req, res) => {
  try {
    const article = await ArticleService.getArticle(req.params.slug);
    
    if (!article || article.published === 'false') {
      return res.status(404).send('<h1>Artigo não encontrado</h1>');
    }
    
    const related = await ArticleService.getRelatedArticles(article.category, article.slug, 3);
    
    const fs = require('fs');
    const viewsPath = path.join(__dirname, 'views');
    
    if (!fs.existsSync(`${viewsPath}/article.ejs`)) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>${article.title}</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-gray-100">
          <div class="container mx-auto px-4 py-8 max-w-4xl">
            <h1 class="text-4xl font-bold">${article.title}</h1>
            <div class="text-gray-600 mt-2">Por ${article.author} | ${new Date(article.createdAt).toLocaleDateString()}</div>
            <img src="${article.coverImage}" class="mt-4 rounded-lg w-full">
            <div class="mt-6 prose">${article.content}</div>
            <a href="/" class="inline-block mt-6 text-blue-600">← Voltar</a>
          </div>
        </body>
        </html>
      `);
    }
    
    res.render('article', {
      article,
      related,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(`<h1>Erro</h1><pre>${error.message}</pre>`);
  }
});

// =================================================================
// ROTAS ADMIN SIMPLES
// =================================================================

// Login admin
app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 class="text-2xl font-bold text-center mb-6">🔐 Admin Login</h1>
        <form method="POST" action="/admin/login">
          <input type="password" name="password" placeholder="Senha" class="w-full p-3 border rounded-lg mb-4">
          <button type="submit" class="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">Entrar</button>
        </form>
        <div class="text-center mt-4"><a href="/" class="text-blue-600">← Voltar ao site</a></div>
      </div>
    </body>
    </html>
  `);
});

app.post('/admin/login', (req, res) => {
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (req.body.password === adminPass) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.send('<h1>Senha incorreta!</h1><a href="/admin/login">Tentar novamente</a>');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard
app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const { articles, total } = await ArticleService.listArticles(1, 1000);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Admin Dashboard</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="bg-gray-100">
        <div class="container mx-auto px-4 py-8">
          <div class="bg-white rounded-lg shadow p-6">
            <h1 class="text-2xl font-bold mb-4">✅ Painel Administrativo</h1>
            <p class="mb-4">Total de artigos: <strong>${total}</strong></p>
            <div class="bg-green-100 p-4 rounded mb-4">
              ✅ Redis Cloud conectado com sucesso!
            </div>
            <div class="flex gap-4">
              <a href="/admin/articles/new" class="bg-green-600 text-white px-4 py-2 rounded">📝 Novo Artigo</a>
              <a href="/admin/articles" class="bg-blue-600 text-white px-4 py-2 rounded">📋 Listar Artigos</a>
              <a href="/" class="bg-gray-600 text-white px-4 py-2 rounded">🌐 Ver Site</a>
              <a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a>
            </div>
            <div class="mt-6">
              <h2 class="font-bold mb-2">Últimos Artigos:</h2>
              <ul class="list-disc pl-5">
                ${articles.slice(0, 5).map(a => `<li><a href="/artigo/${a.slug}" target="_blank">${a.title}</a></li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Erro');
  }
});

// Listar artigos
app.get('/admin/articles', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const { articles } = await ArticleService.listArticles(1, 100);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Artigos</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="bg-gray-100">
        <div class="container mx-auto px-4 py-8">
          <div class="bg-white rounded-lg shadow p-6">
            <h1 class="text-2xl font-bold mb-4">📋 Artigos</h1>
            <a href="/admin/dashboard" class="text-blue-600 mb-4 inline-block">← Voltar</a>
            <table class="w-full mt-4">
              <thead><tr class="border-b"><th class="text-left py-2">Título</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                ${articles.map(a => `
                  <tr class="border-b">
                    <td class="py-2">${a.title}</td>
                    <td>${a.category}</td>
                    <td>${a.published === 'true' ? '✅ Publicado' : '📝 Rascunho'}</td>
                    <td>
                      <a href="/artigo/${a.slug}" target="_blank" class="text-blue-600">Ver</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Erro');
  }
});

// Criar artigo
app.get('/admin/articles/new', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Novo Artigo</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">📝 Novo Artigo</h1>
          <form method="POST" action="/admin/articles/new">
            <input type="text" name="title" placeholder="Título" class="w-full p-3 border rounded mb-3" required>
            <select name="category" class="w-full p-3 border rounded mb-3">
              <option value="Tecnologia">Tecnologia</option>
              <option value="Marketing">Marketing</option>
              <option value="Produtividade">Produtividade</option>
            </select>
            <input type="text" name="author" placeholder="Autor" class="w-full p-3 border rounded mb-3" value="Admin">
            <textarea name="content" placeholder="Conteúdo do artigo (HTML/Markdown)" rows="10" class="w-full p-3 border rounded mb-3" required></textarea>
            <input type="text" name="coverImage" placeholder="URL da imagem destacada" class="w-full p-3 border rounded mb-3">
            <div class="flex items-center mb-4">
              <input type="checkbox" name="published" class="mr-2"> Publicar agora
            </div>
            <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded">Salvar Artigo</button>
            <a href="/admin/dashboard" class="ml-2 text-gray-600">Cancelar</a>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/admin/articles/new', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const { title, content, author, category, coverImage, published } = req.body;
    
    await ArticleService.createArticle({
      title,
      content: content || '<p>Conteúdo do artigo</p>',
      excerpt: content?.substring(0, 160),
      coverImage: coverImage || 'https://picsum.photos/id/1/1200/630',
      author,
      category,
      published: published === 'on'
    });
    
    res.redirect('/admin/articles');
  } catch (error) {
    res.status(500).send('Erro ao criar artigo: ' + error.message);
  }
});

// =================================================================
// ROTAS DE TESTE
// =================================================================
app.get('/redis-test', async (req, res) => {
  try {
    const redis = await getRedisClient();
    await redis.set('test-key', 'Redis Cloud funcionando!');
    const value = await redis.get('test-key');
    const allKeys = await redis.keys('*');
    
    res.json({ 
      status: 'ok', 
      message: value,
      redis: 'conectado',
      totalKeys: allKeys.length,
      keys: allKeys.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// =================================================================
// EXPORT PARA VERCEL
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin/login`);
    console.log(`✅ Redis Cloud conectado`);
  });
}
