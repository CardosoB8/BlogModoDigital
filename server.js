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

// Configurações de segurança
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições' }
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sessão em memória
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
// FUNÇÕES DE ARTIGOS COM COMANDOS REDIS CORRETOS
// =================================================================
class ArticleService {
  static async createArticle(data) {
    const redis = await getRedisClient();
    const id = uuidv4();
    const slug = slugify(data.title, { lower: true, strict: true });
    const now = new Date().toISOString();
    
    const article = {
      id: id,
      slug: slug,
      title: data.title || '',
      content: data.content || '<p>Conteúdo do artigo</p>',
      excerpt: data.excerpt || (data.content ? data.content.replace(/<[^>]*>/g, '').substring(0, 160) : 'Artigo sem resumo'),
      coverImage: data.coverImage || 'https://picsum.photos/id/1/1200/630',
      coverAlt: data.coverAlt || data.title,
      author: data.author || 'Admin',
      category: data.category || 'Tecnologia',
      tags: JSON.stringify(data.tags || []),
      metaTitle: data.metaTitle || data.title,
      metaDescription: data.metaDescription || data.excerpt,
      keywords: data.keywords || data.category,
      published: data.published !== false ? 'true' : 'false',
      createdAt: now,
      updatedAt: now,
      views: '0'
    };
    
    // CORREÇÃO: Usar hSet com campos separados
    await redis.hSet(`article:${slug}`, 
      'id', article.id,
      'slug', article.slug,
      'title', article.title,
      'content', article.content,
      'excerpt', article.excerpt,
      'coverImage', article.coverImage,
      'coverAlt', article.coverAlt,
      'author', article.author,
      'category', article.category,
      'tags', article.tags,
      'metaTitle', article.metaTitle,
      'metaDescription', article.metaDescription,
      'keywords', article.keywords,
      'published', article.published,
      'createdAt', article.createdAt,
      'updatedAt', article.updatedAt,
      'views', article.views
    );
    
    // Adicionar ao índice de todos os artigos
    await redis.sAdd('articles:all', slug);
    
    if (article.published === 'true') {
      await redis.zAdd('articles:published', { score: Date.now(), value: slug });
      await redis.sAdd(`articles:category:${article.category}`, slug);
    }
    
    console.log(`✅ Artigo criado: ${slug}`);
    return article;
  }
  
  static async getArticle(slug) {
    const redis = await getRedisClient();
    const article = await redis.hGetAll(`article:${slug}`);
    
    if (!article || Object.keys(article).length === 0) return null;
    
    // Incrementar views
    const views = parseInt(article.views || '0') + 1;
    await redis.hSet(`article:${slug}`, 'views', views.toString());
    await redis.zIncrBy('articles:views', 1, slug);
    
    return article;
  }
  
  static async listArticles(page = 1, limit = 10, category = null, search = null) {
    const redis = await getRedisClient();
    let slugs = [];
    
    if (category && category !== 'all' && category !== 'null') {
      slugs = await redis.sMembers(`articles:category:${category}`);
    } else {
      const allSlugs = await redis.zRange('articles:published', 0, -1);
      slugs = allSlugs.reverse();
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
    const slugs = await redis.zRange('articles:views', 0, limit - 1);
    const articles = [];
    
    for (const slug of slugs.reverse()) {
      const article = await this.getArticle(slug);
      if (article && article.published === 'true') articles.push(article);
    }
    
    return articles;
  }
  
  static async getAllArticles() {
    const redis = await getRedisClient();
    const slugs = await redis.sMembers('articles:all');
    const articles = [];
    
    for (const slug of slugs) {
      const article = await this.getArticle(slug);
      if (article) articles.push(article);
    }
    
    return articles;
  }
}

// =================================================================
// MIDDLEWARE PARA CONFIGURAÇÃO DO SITE
// =================================================================
app.use(async (req, res, next) => {
  try {
    const redis = await getRedisClient();
    let config = await redis.hGetAll('site:config');
    
    if (!config || Object.keys(config).length === 0) {
      config = {
        title: process.env.SITE_TITLE || 'ModoDigital',
        description: process.env.SITE_DESCRIPTION || 'Dicas e tutoriais para sua vida digital',
        siteUrl: process.env.SITE_URL || 'https://blog-modo-digital.vercel.app'
      };
      await redis.hSet('site:config', config);
    }
    
    res.locals.siteConfig = config;
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
// ROTAS DO SITE
// =================================================================

app.get('/admin', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.redirect('/admin/login');
});

app.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const { articles, total, totalPages } = await ArticleService.listArticles(page, 9);
    const popular = await ArticleService.getPopularArticles(5);
    
    res.send(`
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${res.locals.siteConfig.title} - Blog de Tecnologia</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      </head>
      <body class="bg-gray-50">
        <header class="bg-white shadow-sm sticky top-0 z-50">
          <div class="container mx-auto px-4 py-4 flex justify-between items-center">
            <a href="/" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ${res.locals.siteConfig.title}
            </a>
            <a href="/admin" class="text-gray-600 hover:text-blue-600">🔐 Admin</a>
          </div>
        </header>
        
        <main class="container mx-auto px-4 py-8">
          <div class="text-center mb-12">
            <h1 class="text-4xl md:text-5xl font-bold mb-4">${res.locals.siteConfig.title}</h1>
            <p class="text-xl text-gray-600">${res.locals.siteConfig.description}</p>
          </div>
          
          <div class="grid md:grid-cols-3 gap-6 mb-12">
            ${articles.map(article => `
              <article class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition">
                <img src="${article.coverImage}" alt="${article.title}" class="w-full h-48 object-cover">
                <div class="p-5">
                  <span class="text-xs text-blue-600 font-semibold">${article.category}</span>
                  <h2 class="text-xl font-bold mt-2 mb-3 hover:text-blue-600">
                    <a href="/artigo/${article.slug}">${article.title}</a>
                  </h2>
                  <p class="text-gray-600 text-sm">${article.excerpt.substring(0, 120)}...</p>
                  <div class="flex justify-between items-center mt-4 text-xs text-gray-500">
                    <span>👤 ${article.author}</span>
                    <span>📅 ${new Date(article.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
          
          ${articles.length === 0 ? '<p class="text-center text-gray-500">Nenhum artigo publicado ainda.</p>' : ''}
          
          <div class="mt-12 text-center">
            <a href="/admin/login" class="inline-block bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700">📝 Área Administrativa</a>
          </div>
        </main>
        
        <footer class="bg-gray-900 text-gray-300 mt-12 py-8">
          <div class="container mx-auto px-4 text-center text-sm">
            &copy; 2026 ${res.locals.siteConfig.title}
          </div>
        </footer>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send(`<h1>Erro</h1><pre>${error.message}</pre>`);
  }
});

app.get('/artigo/:slug', async (req, res) => {
  try {
    const article = await ArticleService.getArticle(req.params.slug);
    
    if (!article || article.published === 'false') {
      return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
    }
    
    res.send(`
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${article.title} | ${res.locals.siteConfig.title}</title>
        <meta name="description" content="${article.excerpt}">
        <meta property="og:title" content="${article.title}">
        <meta property="og:description" content="${article.excerpt}">
        <meta property="og:image" content="${article.coverImage}">
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50">
        <header class="bg-white shadow-sm sticky top-0 z-50">
          <div class="container mx-auto px-4 py-4 flex justify-between items-center">
            <a href="/" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ${res.locals.siteConfig.title}
            </a>
            <a href="/admin" class="text-gray-600 hover:text-blue-600">🔐 Admin</a>
          </div>
        </header>
        
        <main class="container mx-auto px-4 py-8 max-w-4xl">
          <article class="bg-white rounded-xl shadow-md p-6 md:p-8">
            <h1 class="text-3xl md:text-4xl font-bold mb-4">${article.title}</h1>
            <div class="flex gap-4 text-sm text-gray-500 mb-6">
              <span>👤 ${article.author}</span>
              <span>📅 ${new Date(article.createdAt).toLocaleDateString('pt-BR')}</span>
              <span>👁️ ${article.views} visualizações</span>
            </div>
            <img src="${article.coverImage}" alt="${article.title}" class="w-full rounded-lg mb-6">
            <div class="prose max-w-none">${article.content}</div>
          </article>
          
          <div class="mt-8 text-center">
            <a href="/" class="text-blue-600 hover:underline">← Voltar para o início</a>
          </div>
        </main>
        
        <footer class="bg-gray-900 text-gray-300 mt-12 py-8">
          <div class="container mx-auto px-4 text-center text-sm">
            &copy; 2026 ${res.locals.siteConfig.title}
          </div>
        </footer>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send(`<h1>Erro</h1><pre>${error.message}</pre>`);
  }
});

// =================================================================
// ROTAS ADMIN
// =================================================================

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
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
        <div class="text-center mt-4"><a href="/" class="text-blue-600">← Voltar</a></div>
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

app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const articles = await ArticleService.getAllArticles();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Admin Dashboard</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">✅ Painel Admin</h1>
          <p class="mb-4">Total de artigos: <strong>${articles.length}</strong></p>
          <div class="bg-green-100 p-4 rounded mb-4">✅ Redis Cloud conectado!</div>
          <div class="flex gap-4 flex-wrap">
            <a href="/admin/articles/new" class="bg-green-600 text-white px-4 py-2 rounded">📝 Novo Artigo</a>
            <a href="/admin/articles" class="bg-blue-600 text-white px-4 py-2 rounded">📋 Listar Artigos</a>
            <a href="/" class="bg-gray-600 text-white px-4 py-2 rounded">🌐 Ver Site</a>
            <a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/admin/articles', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const articles = await ArticleService.getAllArticles();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Artigos</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">📋 Todos os Artigos</h1>
          <a href="/admin/dashboard" class="text-blue-600 mb-4 inline-block">← Voltar</a>
          <div class="grid gap-4 mt-4">
            ${articles.map(a => `
              <div class="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h3 class="font-bold">${a.title}</h3>
                  <p class="text-sm text-gray-500">${a.category} | ${a.author} | ${new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
                <a href="/artigo/${a.slug}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ver</a>
              </div>
            `).join('')}
          </div>
          ${articles.length === 0 ? '<p class="text-center text-gray-500">Nenhum artigo criado ainda.</p>' : ''}
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/admin/articles/new', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Novo Artigo</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">📝 Criar Novo Artigo</h1>
          <form method="POST" action="/admin/articles/new">
            <div class="mb-4">
              <label class="block font-bold mb-2">Título *</label>
              <input type="text" name="title" class="w-full p-3 border rounded" required>
            </div>
            <div class="mb-4">
              <label class="block font-bold mb-2">Categoria</label>
              <select name="category" class="w-full p-3 border rounded">
                <option value="Tecnologia">Tecnologia</option>
                <option value="Marketing">Marketing</option>
                <option value="Produtividade">Produtividade</option>
              </select>
            </div>
            <div class="mb-4">
              <label class="block font-bold mb-2">Autor</label>
              <input type="text" name="author" value="Admin" class="w-full p-3 border rounded">
            </div>
            <div class="mb-4">
              <label class="block font-bold mb-2">URL da Imagem (opcional)</label>
              <input type="text" name="coverImage" placeholder="https://..." class="w-full p-3 border rounded">
            </div>
            <div class="mb-4">
              <label class="block font-bold mb-2">Conteúdo *</label>
              <textarea name="content" rows="12" class="w-full p-3 border rounded font-mono text-sm" required></textarea>
              <p class="text-xs text-gray-500 mt-1">Você pode usar HTML: &lt;p&gt;, &lt;h2&gt;, &lt;img&gt;, &lt;ul&gt;, etc.</p>
            </div>
            <div class="mb-4">
              <label class="flex items-center">
                <input type="checkbox" name="published" class="mr-2" checked> Publicar imediatamente
              </label>
            </div>
            <div class="flex gap-3">
              <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">💾 Salvar Artigo</button>
              <a href="/admin/dashboard" class="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600">Cancelar</a>
            </div>
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
    
    if (!title || !content) {
      throw new Error('Título e conteúdo são obrigatórios');
    }
    
    const article = await ArticleService.createArticle({
      title: title,
      content: content,
      author: author || 'Admin',
      category: category || 'Tecnologia',
      coverImage: coverImage || 'https://picsum.photos/id/1/1200/630',
      published: published === 'on'
    });
    
    console.log('✅ Artigo criado:', article.slug);
    res.redirect('/admin/articles');
  } catch (error) {
    console.error('Erro ao criar artigo:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Erro</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="bg-gray-100 p-8">
        <div class="max-w-2xl mx-auto bg-white p-6 rounded shadow">
          <h1 class="text-2xl font-bold text-red-600 mb-4">Erro ao criar artigo</h1>
          <p class="mb-4">${error.message}</p>
          <pre class="bg-gray-100 p-4 rounded text-sm overflow-auto">${error.stack || ''}</pre>
          <a href="/admin/articles/new" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded">Voltar</a>
        </div>
      </body>
      </html>
    `);
  }
});

// =================================================================
// ROTA DE TESTE REDIS
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
      totalKeys: allKeys.length
    });
  } catch (error) {
    res.json({ status: 'error', error: error.message });
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
