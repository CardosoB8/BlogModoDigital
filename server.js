const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { createClient } = require('redis');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

app.use(session({
  secret: process.env.SESSION_SECRET || 'minha_chave_super_secreta_123456789',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// =================================================================
// REDIS CLIENT
// =================================================================
let redisClient = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: 'redis://default:JyefUsxHJljfdvs8HACumEyLE7XNgLvG@redis-19242.c266.us-east-1-3.ec2.cloud.redislabs.com:19242'
    });
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    redisClient.on('connect', () => console.log('✅ Redis conectado!'));
    await redisClient.connect();
  }
  return redisClient;
}

// =================================================================
// ARTIGOS - VERSÃO SIMPLES E FUNCIONAL
// =================================================================

// Criar artigo
app.post('/api/articles', async (req, res) => {
  try {
    const redis = await getRedis();
    const { title, content, category, author, coverImage } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }
    
    const slug = slugify(title, { lower: true, strict: true });
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const article = {
      id: id,
      slug: slug,
      title: title,
      content: content,
      excerpt: content.replace(/<[^>]*>/g, '').substring(0, 160),
      coverImage: coverImage || 'https://picsum.photos/id/1/1200/630',
      author: author || 'Admin',
      category: category || 'Tecnologia',
      published: 'true',
      createdAt: now,
      updatedAt: now,
      views: '0'
    };
    
    // Salvar no Redis
    await redis.hSet(`article:${slug}`, 
      'id', article.id,
      'slug', article.slug,
      'title', article.title,
      'content', article.content,
      'excerpt', article.excerpt,
      'coverImage', article.coverImage,
      'author', article.author,
      'category', article.category,
      'published', article.published,
      'createdAt', article.createdAt,
      'updatedAt', article.updatedAt,
      'views', article.views
    );
    
    await redis.sAdd('articles:all', slug);
    await redis.zAdd('articles:published', { score: Date.now(), value: slug });
    await redis.sAdd(`articles:category:${article.category}`, slug);
    
    console.log('✅ Artigo criado:', slug, title);
    res.json({ success: true, article });
    
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar artigos
app.get('/api/articles', async (req, res) => {
  try {
    const redis = await getRedis();
    const slugs = await redis.zRange('articles:published', 0, -1);
    const articles = [];
    
    for (const slug of slugs.reverse()) {
      const article = await redis.hGetAll(`article:${slug}`);
      if (article && Object.keys(article).length > 0 && article.published === 'true') {
        articles.push(article);
      }
    }
    
    res.json({ articles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar artigo por slug
app.get('/api/articles/:slug', async (req, res) => {
  try {
    const redis = await getRedis();
    const article = await redis.hGetAll(`article:${req.params.slug}`);
    
    if (!article || Object.keys(article).length === 0) {
      return res.status(404).json({ error: 'Artigo não encontrado' });
    }
    
    // Incrementar views
    const views = parseInt(article.views || '0') + 1;
    await redis.hSet(`article:${req.params.slug}`, 'views', views.toString());
    article.views = views.toString();
    
    res.json({ article });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================================================================
// FRONTEND - HTML DIRETO
// =================================================================

// Página inicial
app.get('/', async (req, res) => {
  try {
    const redis = await getRedis();
    const slugs = await redis.zRange('articles:published', 0, -1);
    const articles = [];
    
    for (const slug of slugs.reverse()) {
      const article = await redis.hGetAll(`article:${slug}`);
      if (article && Object.keys(article).length > 0 && article.published === 'true') {
        articles.push(article);
      }
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ModoDigital - Blog de Tecnologia</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .article-card { transition: transform 0.2s; }
          .article-card:hover { transform: translateY(-4px); }
        </style>
      </head>
      <body class="bg-gray-50">
        <header class="bg-white shadow-sm sticky top-0 z-50">
          <div class="container mx-auto px-4 py-4 flex justify-between items-center">
            <a href="/" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ModoDigital</a>
            <a href="/admin" class="text-gray-600 hover:text-blue-600">🔐 Admin</a>
          </div>
        </header>
        
        <main class="container mx-auto px-4 py-8">
          <div class="text-center mb-12">
            <h1 class="text-4xl md:text-5xl font-bold mb-4">ModoDigital</h1>
            <p class="text-xl text-gray-600">Dicas e tutoriais para sua vida digital</p>
          </div>
          
          <div class="grid md:grid-cols-3 gap-6">
            ${articles.map(article => `
              <div class="bg-white rounded-xl shadow-md overflow-hidden article-card">
                <img src="${article.coverImage}" class="w-full h-48 object-cover">
                <div class="p-5">
                  <span class="text-xs text-blue-600 font-semibold">${article.category}</span>
                  <h2 class="text-xl font-bold mt-2 mb-3">
                    <a href="/artigo/${article.slug}" class="hover:text-blue-600">${article.title}</a>
                  </h2>
                  <p class="text-gray-600 text-sm">${article.excerpt.substring(0, 120)}...</p>
                  <div class="flex justify-between items-center mt-4 text-xs text-gray-500">
                    <span>👤 ${article.author}</span>
                    <span>📅 ${new Date(article.createdAt).toLocaleDateString('pt-BR')}</span>
                    <span>👁️ ${article.views}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${articles.length === 0 ? '<p class="text-center text-gray-500 mt-8">Nenhum artigo publicado ainda. <a href="/admin" class="text-blue-600">Crie seu primeiro artigo!</a></p>' : ''}
          
          <div class="mt-12 text-center">
            <a href="/admin" class="inline-block bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700">📝 Área Administrativa</a>
          </div>
        </main>
        
        <footer class="bg-gray-900 text-gray-300 mt-12 py-8 text-center text-sm">
          &copy; 2026 ModoDigital
        </footer>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`<h1>Erro</h1><pre>${error.message}</pre>`);
  }
});

// Página do artigo
app.get('/artigo/:slug', async (req, res) => {
  try {
    const redis = await getRedis();
    const article = await redis.hGetAll(`article:${req.params.slug}`);
    
    if (!article || Object.keys(article).length === 0 || article.published !== 'true') {
      return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
    }
    
    // Incrementar views
    const views = parseInt(article.views || '0') + 1;
    await redis.hSet(`article:${req.params.slug}`, 'views', views.toString());
    article.views = views.toString();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${article.title} | ModoDigital</title>
        <meta name="description" content="${article.excerpt}">
        <meta property="og:title" content="${article.title}">
        <meta property="og:description" content="${article.excerpt}">
        <meta property="og:image" content="${article.coverImage}">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .article-content { line-height: 1.8; }
          .article-content p { margin-bottom: 1rem; }
          .article-content h2 { font-size: 1.5rem; margin: 1.5rem 0 1rem; font-weight: bold; }
          .article-content img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
          .article-content ul, .article-content ol { margin: 1rem 0 1rem 2rem; }
          .article-content li { margin: 0.25rem 0; }
        </style>
      </head>
      <body class="bg-gray-50">
        <header class="bg-white shadow-sm sticky top-0 z-50">
          <div class="container mx-auto px-4 py-4 flex justify-between items-center">
            <a href="/" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ModoDigital</a>
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
            <img src="${article.coverImage}" class="w-full rounded-lg mb-6">
            <div class="article-content">${article.content}</div>
          </article>
          
          <div class="mt-8 text-center">
            <a href="/" class="text-blue-600 hover:underline">← Voltar para o início</a>
          </div>
        </main>
        
        <footer class="bg-gray-900 text-gray-300 mt-12 py-8 text-center text-sm">
          &copy; 2026 ModoDigital
        </footer>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`<h1>Erro</h1><pre>${error.message}</pre>`);
  }
});

// =================================================================
// ADMIN
// =================================================================

app.get('/admin', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.redirect('/admin/login');
});

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
  if (req.body.password === 'admin123') {
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
  
  try {
    const redis = await getRedis();
    const slugs = await redis.zRange('articles:published', 0, -1);
    const articles = [];
    
    for (const slug of slugs.reverse()) {
      const article = await redis.hGetAll(`article:${slug}`);
      if (article && Object.keys(article).length > 0) {
        articles.push(article);
      }
    }
    
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
              <a href="/admin/new" class="bg-green-600 text-white px-4 py-2 rounded">📝 Novo Artigo</a>
              <a href="/admin/articles" class="bg-blue-600 text-white px-4 py-2 rounded">📋 Listar Artigos</a>
              <a href="/" class="bg-gray-600 text-white px-4 py-2 rounded">🌐 Ver Site</a>
              <a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a>
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

app.get('/admin/articles', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const redis = await getRedis();
    const slugs = await redis.zRange('articles:published', 0, -1);
    const articles = [];
    
    for (const slug of slugs.reverse()) {
      const article = await redis.hGetAll(`article:${slug}`);
      if (article && Object.keys(article).length > 0) {
        articles.push(article);
      }
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Artigos</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="bg-gray-100">
        <div class="container mx-auto px-4 py-8">
          <div class="bg-white rounded-lg shadow p-6">
            <h1 class="text-2xl font-bold mb-4">📋 Todos os Artigos</h1>
            <a href="/admin/dashboard" class="text-blue-600 mb-4 inline-block">← Voltar</a>
            ${articles.map(a => `
              <div class="border rounded-lg p-4 mb-3 flex justify-between items-center">
                <div>
                  <h3 class="font-bold">${a.title}</h3>
                  <p class="text-sm text-gray-500">${a.category} | ${a.author} | ${new Date(a.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <div class="flex gap-2">
                  <a href="/artigo/${a.slug}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ver</a>
                </div>
              </div>
            `).join('')}
            ${articles.length === 0 ? '<p class="text-center text-gray-500">Nenhum artigo criado ainda.</p>' : ''}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Erro');
  }
});

app.get('/admin/new', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Novo Artigo</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">📝 Criar Novo Artigo</h1>
          <form method="POST" action="/admin/new">
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
              <input type="text" name="coverImage" placeholder="https://picsum.photos/id/1/1200/630" class="w-full p-3 border rounded">
            </div>
            <div class="mb-4">
              <label class="block font-bold mb-2">Conteúdo *</label>
              <textarea name="content" rows="12" class="w-full p-3 border rounded font-mono text-sm" required></textarea>
              <p class="text-xs text-gray-500 mt-1">Você pode usar HTML: &lt;p&gt;, &lt;h2&gt;, &lt;img&gt;, &lt;ul&gt;, &lt;li&gt;, etc.</p>
            </div>
            <div class="flex gap-3">
              <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">💾 Publicar Artigo</button>
              <a href="/admin/dashboard" class="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/admin/new', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const redis = await getRedis();
    const { title, content, category, author, coverImage } = req.body;
    
    if (!title || !content) {
      throw new Error('Título e conteúdo são obrigatórios');
    }
    
    const slug = slugify(title, { lower: true, strict: true });
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const article = {
      id: id,
      slug: slug,
      title: title,
      content: content,
      excerpt: content.replace(/<[^>]*>/g, '').substring(0, 160),
      coverImage: coverImage || 'https://picsum.photos/id/1/1200/630',
      author: author || 'Admin',
      category: category || 'Tecnologia',
      published: 'true',
      createdAt: now,
      updatedAt: now,
      views: '0'
    };
    
    await redis.hSet(`article:${slug}`, 
      'id', article.id,
      'slug', article.slug,
      'title', article.title,
      'content', article.content,
      'excerpt', article.excerpt,
      'coverImage', article.coverImage,
      'author', article.author,
      'category', article.category,
      'published', article.published,
      'createdAt', article.createdAt,
      'updatedAt', article.updatedAt,
      'views', article.views
    );
    
    await redis.sAdd('articles:all', slug);
    await redis.zAdd('articles:published', { score: Date.now(), value: slug });
    await redis.sAdd(`articles:category:${article.category}`, slug);
    
    console.log('✅ Artigo criado:', slug, title);
    res.redirect('/admin/articles');
    
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).send(`
      <h1>Erro ao criar artigo</h1>
      <p>${error.message}</p>
      <a href="/admin/new">Voltar</a>
    `);
  }
});

// =================================================================
// TESTE
// =================================================================
app.get('/redis-test', async (req, res) => {
  try {
    const redis = await getRedis();
    await redis.set('test', 'ok');
    const test = await redis.get('test');
    res.json({ status: 'ok', redis: 'conectado', test });
  } catch (error) {
    res.json({ status: 'error', error: error.message });
  }
});

// =================================================================
// EXPORT
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(3000, () => console.log('🚀 Servidor rodando em http://localhost:3000'));
}
