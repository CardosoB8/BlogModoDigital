const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// =================================================================
// CONFIGURAÇÕES BÁSICAS
// =================================================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Sessão simples em memória (sem connect-redis)
app.use(session({
  secret: 'mododigital-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// =================================================================
// REDIS CLIENT
// =================================================================
let redis = null;

async function getRedis() {
  if (!redis) {
    redis = createClient({
      url: 'redis://default:JyefUsxHJljfdvs8HACumEyLE7XNgLvG@redis-19242.c266.us-east-1-3.ec2.cloud.redislabs.com:19242'
    });
    redis.on('error', (err) => console.error('Redis:', err.message));
    redis.on('connect', () => console.log('✅ Redis conectado'));
    await redis.connect();
  }
  return redis;
}

// =================================================================
// FUNÇÕES DOS ARTIGOS
// =================================================================
async function criarArtigo(dados) {
  const r = await getRedis();
  const slug = slugify(dados.titulo, { lower: true, strict: true });
  const id = uuidv4();
  const agora = new Date().toISOString();
  
  const artigo = {
    id, slug,
    titulo: dados.titulo,
    conteudo: dados.conteudo,
    resumo: dados.conteudo.replace(/<[^>]*>/g, '').substring(0, 160),
    imagem: dados.imagem || 'https://picsum.photos/id/1/1200/630',
    autor: dados.autor || 'Admin',
    categoria: dados.categoria || 'Tecnologia',
    publicado: 'true',
    criado: agora,
    atualizado: agora,
    views: '0'
  };
  
  // Salvar no Redis
  await r.hSet(`artigo:${slug}`, 
    'id', artigo.id,
    'slug', artigo.slug,
    'titulo', artigo.titulo,
    'conteudo', artigo.conteudo,
    'resumo', artigo.resumo,
    'imagem', artigo.imagem,
    'autor', artigo.autor,
    'categoria', artigo.categoria,
    'publicado', artigo.publicado,
    'criado', artigo.criado,
    'atualizado', artigo.atualizado,
    'views', artigo.views
  );
  
  await r.sAdd('artigos:todos', slug);
  await r.zAdd('artigos:publicados', { score: Date.now(), value: slug });
  await r.sAdd(`artigos:categoria:${artigo.categoria}`, slug);
  
  return artigo;
}

async function listarArtigos() {
  const r = await getRedis();
  const slugs = await r.zRange('artigos:publicados', 0, -1);
  const artigos = [];
  
  for (const slug of slugs.reverse()) {
    const artigo = await r.hGetAll(`artigo:${slug}`);
    if (artigo && Object.keys(artigo).length > 0 && artigo.publicado === 'true') {
      artigos.push(artigo);
    }
  }
  return artigos;
}

async function buscarArtigo(slug) {
  const r = await getRedis();
  const artigo = await r.hGetAll(`artigo:${slug}`);
  
  if (!artigo || Object.keys(artigo).length === 0) return null;
  
  const views = parseInt(artigo.views || '0') + 1;
  await r.hSet(`artigo:${slug}`, 'views', views.toString());
  artigo.views = views.toString();
  
  return artigo;
}

// =================================================================
// PÁGINAS
// =================================================================

// Home
app.get('/', async (req, res) => {
  try {
    const artigos = await listarArtigos();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ModoDigital - Blog de Tecnologia</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .card { transition: transform 0.2s; }
          .card:hover { transform: translateY(-4px); }
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
            ${artigos.map(a => `
              <div class="bg-white rounded-xl shadow-md overflow-hidden card">
                <img src="${a.imagem}" class="w-full h-48 object-cover">
                <div class="p-5">
                  <span class="text-xs text-blue-600 font-semibold">${a.categoria}</span>
                  <h2 class="text-xl font-bold mt-2 mb-3">
                    <a href="/artigo/${a.slug}" class="hover:text-blue-600">${a.titulo}</a>
                  </h2>
                  <p class="text-gray-600 text-sm">${a.resumo.substring(0, 120)}...</p>
                  <div class="flex justify-between items-center mt-4 text-xs text-gray-500">
                    <span>👤 ${a.autor}</span>
                    <span>📅 ${new Date(a.criado).toLocaleDateString('pt-BR')}</span>
                    <span>👁️ ${a.views}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${artigos.length === 0 ? '<p class="text-center text-gray-500 mt-8">Nenhum artigo ainda. <a href="/admin" class="text-blue-600">Crie o primeiro!</a></p>' : ''}
          
          <div class="mt-12 text-center">
            <a href="/admin" class="inline-block bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700">📝 Área Admin</a>
          </div>
        </main>
        
        <footer class="bg-gray-900 text-gray-300 mt-12 py-8 text-center text-sm">
          &copy; 2026 ModoDigital
        </footer>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Erro</h1><pre>${err.message}</pre>`);
  }
});

// Artigo
app.get('/artigo/:slug', async (req, res) => {
  try {
    const artigo = await buscarArtigo(req.params.slug);
    
    if (!artigo) {
      return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${artigo.titulo} | ModoDigital</title>
        <meta name="description" content="${artigo.resumo}">
        <meta property="og:title" content="${artigo.titulo}">
        <meta property="og:description" content="${artigo.resumo}">
        <meta property="og:image" content="${artigo.imagem}">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .conteudo { line-height: 1.8; }
          .conteudo p { margin-bottom: 1rem; }
          .conteudo h2 { font-size: 1.5rem; margin: 1.5rem 0 1rem; font-weight: bold; }
          .conteudo img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
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
            <h1 class="text-3xl md:text-4xl font-bold mb-4">${artigo.titulo}</h1>
            <div class="flex gap-4 text-sm text-gray-500 mb-6">
              <span>👤 ${artigo.autor}</span>
              <span>📅 ${new Date(artigo.criado).toLocaleDateString('pt-BR')}</span>
              <span>👁️ ${artigo.views} visualizações</span>
            </div>
            <img src="${artigo.imagem}" class="w-full rounded-lg mb-6">
            <div class="conteudo">${artigo.conteudo}</div>
          </article>
          
          <div class="mt-8 text-center">
            <a href="/" class="text-blue-600 hover:underline">← Voltar</a>
          </div>
        </main>
        
        <footer class="bg-gray-900 text-gray-300 mt-12 py-8 text-center text-sm">
          &copy; 2026 ModoDigital
        </footer>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Erro</h1><pre>${err.message}</pre>`);
  }
});

// =================================================================
// ADMIN
// =================================================================

app.get('/admin', (req, res) => {
  if (req.session.admin) return res.redirect('/admin/dashboard');
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Admin Login</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 class="text-2xl font-bold text-center mb-6">🔐 Login</h1>
        <form method="POST" action="/admin/login">
          <input type="password" name="senha" placeholder="Senha" class="w-full p-3 border rounded-lg mb-4">
          <button type="submit" class="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">Entrar</button>
        </form>
        <div class="text-center mt-4"><a href="/" class="text-blue-600">← Voltar</a></div>
      </div>
    </body>
    </html>
  `);
});

app.post('/admin/login', (req, res) => {
  if (req.body.senha === 'admin123') {
    req.session.admin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.send('<h1>Senha errada!</h1><a href="/admin/login">Tentar</a>');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  const artigos = await listarArtigos();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">✅ Painel Admin</h1>
          <p>Total: <strong>${artigos.length}</strong> artigos</p>
          <div class="bg-green-100 p-3 rounded my-4">✅ Redis conectado!</div>
          <div class="flex gap-3">
            <a href="/admin/novo" class="bg-green-600 text-white px-4 py-2 rounded">📝 Novo Artigo</a>
            <a href="/admin/lista" class="bg-blue-600 text-white px-4 py-2 rounded">📋 Lista</a>
            <a href="/" class="bg-gray-600 text-white px-4 py-2 rounded">🌐 Site</a>
            <a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/admin/lista', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  const artigos = await listarArtigos();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Artigos</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">📋 Artigos</h1>
          <a href="/admin/dashboard" class="text-blue-600">← Voltar</a>
          ${artigos.map(a => `
            <div class="border p-3 mb-2 rounded">
              <h3 class="font-bold">${a.titulo}</h3>
              <p class="text-sm text-gray-500">${a.categoria} | ${a.autor} | ${new Date(a.criado).toLocaleDateString()}</p>
              <a href="/artigo/${a.slug}" target="_blank" class="text-blue-600 text-sm">Ver</a>
            </div>
          `).join('')}
          ${artigos.length === 0 ? '<p>Nenhum artigo</p>' : ''}
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/admin/novo', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Novo Artigo</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">✏️ Criar Artigo</h1>
          <form method="POST" action="/admin/novo">
            <input type="text" name="titulo" placeholder="Título" class="w-full p-3 border rounded mb-3" required>
            <select name="categoria" class="w-full p-3 border rounded mb-3">
              <option value="Tecnologia">Tecnologia</option>
              <option value="Marketing">Marketing</option>
              <option value="Produtividade">Produtividade</option>
            </select>
            <input type="text" name="autor" value="Admin" class="w-full p-3 border rounded mb-3">
            <input type="text" name="imagem" placeholder="URL da imagem" class="w-full p-3 border rounded mb-3">
            <textarea name="conteudo" rows="12" class="w-full p-3 border rounded font-mono" required></textarea>
            <div class="flex gap-3 mt-4">
              <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded">Publicar</button>
              <a href="/admin/dashboard" class="bg-gray-500 text-white px-6 py-2 rounded">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/admin/novo', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  
  try {
    await criarArtigo({
      titulo: req.body.titulo,
      conteudo: req.body.conteudo,
      categoria: req.body.categoria,
      autor: req.body.autor,
      imagem: req.body.imagem
    });
    res.redirect('/admin/lista');
  } catch (err) {
    res.send(`<h1>Erro</h1><pre>${err.message}</pre><a href="/admin/novo">Voltar</a>`);
  }
});

// =================================================================
// TESTE
// =================================================================
app.get('/test-redis', async (req, res) => {
  try {
    const r = await getRedis();
    await r.set('teste', 'ok');
    const val = await r.get('teste');
    res.json({ ok: true, redis: val });
  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

// =================================================================
// EXPORT
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
}
