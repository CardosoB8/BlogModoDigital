const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

app.use(session({
  secret: 'mododigital-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// =================================================================
// REDIS
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
// DEBUG - Ver todas as chaves
// =================================================================
app.get('/debug-keys', async (req, res) => {
  try {
    const r = await getRedis();
    const keys = await r.keys('*');
    res.json({ 
      total: keys.length,
      keys: keys.slice(0, 50)
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.get('/debug-article/:slug', async (req, res) => {
  try {
    const r = await getRedis();
    const artigo = await r.hGetAll(`artigo:${req.params.slug}`);
    res.json(artigo);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// =================================================================
// FUNÇÕES
// =================================================================
async function criarArtigo(dados) {
  const r = await getRedis();
  const slug = slugify(dados.titulo, { lower: true, strict: true });
  const id = uuidv4();
  const agora = new Date().toISOString();
  
  console.log('📝 Criando artigo:', dados.titulo, 'slug:', slug);
  
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
  
  // Salvar
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
  
  console.log('✅ Artigo salvo:', slug);
  return artigo;
}

async function listarArtigos() {
  const r = await getRedis();
  
  // Ver se tem artigos publicados
  const todosSlugs = await r.zRange('artigos:publicados', 0, -1);
  console.log('📚 Slugs encontrados:', todosSlugs);
  
  if (!todosSlugs || todosSlugs.length === 0) {
    return [];
  }
  
  const artigos = [];
  for (const slug of todosSlugs.reverse()) {
    const artigo = await r.hGetAll(`artigo:${slug}`);
    if (artigo && Object.keys(artigo).length > 0) {
      console.log('✅ Carregado:', artigo.titulo);
      artigos.push(artigo);
    }
  }
  
  return artigos;
}

// =================================================================
// PÁGINAS
// =================================================================

app.get('/', async (req, res) => {
  try {
    const artigos = await listarArtigos();
    console.log('🎨 Renderizando home com', artigos.length, 'artigos');
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ModoDigital - Blog</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50">
        <header class="bg-white shadow-sm sticky top-0">
          <div class="container mx-auto px-4 py-4 flex justify-between">
            <a href="/" class="text-2xl font-bold text-blue-600">ModoDigital</a>
            <a href="/admin" class="text-gray-600">🔐 Admin</a>
          </div>
        </header>
        
        <main class="container mx-auto px-4 py-8">
          <div class="text-center mb-12">
            <h1 class="text-4xl font-bold mb-4">ModoDigital</h1>
            <p class="text-xl text-gray-600">Dicas e tutoriais para sua vida digital</p>
          </div>
          
          <div class="grid md:grid-cols-3 gap-6">
            ${artigos.map(a => `
              <div class="bg-white rounded-xl shadow-md overflow-hidden">
                <img src="${a.imagem}" class="w-full h-48 object-cover">
                <div class="p-5">
                  <span class="text-xs text-blue-600">${a.categoria}</span>
                  <h2 class="text-xl font-bold mt-2">
                    <a href="/artigo/${a.slug}" class="hover:text-blue-600">${a.titulo}</a>
                  </h2>
                  <p class="text-gray-600 text-sm mt-2">${a.resumo.substring(0, 100)}...</p>
                  <div class="flex justify-between mt-3 text-xs text-gray-500">
                    <span>${a.autor}</span>
                    <span>${new Date(a.criado).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${artigos.length === 0 ? `
            <div class="text-center py-12">
              <p class="text-gray-500">Nenhum artigo ainda.</p>
              <a href="/admin/novo" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded">Criar primeiro artigo</a>
            </div>
          ` : ''}
        </main>
        
        <footer class="bg-gray-900 text-white mt-12 py-6 text-center text-sm">
          &copy; 2026 ModoDigital
        </footer>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Erro home:', err);
    res.status(500).send(`<h1>Erro</h1><pre>${err.message}</pre>`);
  }
});

app.get('/artigo/:slug', async (req, res) => {
  try {
    const r = await getRedis();
    const artigo = await r.hGetAll(`artigo:${req.params.slug}`);
    
    if (!artigo || Object.keys(artigo).length === 0) {
      return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
    }
    
    const views = parseInt(artigo.views || '0') + 1;
    await r.hSet(`artigo:${req.params.slug}`, 'views', views.toString());
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${artigo.titulo} | ModoDigital</title>
        <meta name="description" content="${artigo.resumo}">
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50">
        <header class="bg-white shadow-sm">
          <div class="container mx-auto px-4 py-4 flex justify-between">
            <a href="/" class="text-2xl font-bold text-blue-600">ModoDigital</a>
            <a href="/admin" class="text-gray-600">🔐 Admin</a>
          </div>
        </header>
        
        <main class="container mx-auto px-4 py-8 max-w-4xl">
          <article class="bg-white rounded-xl shadow-md p-8">
            <h1 class="text-3xl font-bold mb-4">${artigo.titulo}</h1>
            <div class="flex gap-4 text-sm text-gray-500 mb-6">
              <span>👤 ${artigo.autor}</span>
              <span>📅 ${new Date(artigo.criado).toLocaleDateString('pt-BR')}</span>
              <span>👁️ ${artigo.views}</span>
            </div>
            <img src="${artigo.imagem}" class="w-full rounded-lg mb-6">
            <div class="prose max-w-none">${artigo.conteudo}</div>
          </article>
          
          <div class="mt-8 text-center">
            <a href="/" class="text-blue-600">← Voltar</a>
          </div>
        </main>
        
        <footer class="bg-gray-900 text-white mt-12 py-6 text-center text-sm">
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
    <head><title>Login</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100 flex items-center justify-center min-h-screen">
      <div class="bg-white p-8 rounded shadow max-w-md w-full">
        <h1 class="text-2xl font-bold mb-6 text-center">🔐 Admin</h1>
        <form method="POST" action="/admin/login">
          <input type="password" name="senha" placeholder="Senha" class="w-full p-3 border rounded mb-4">
          <button type="submit" class="w-full bg-blue-600 text-white p-3 rounded">Entrar</button>
        </form>
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
    res.send('<h1>Senha errada</h1><a href="/admin/login">Voltar</a>');
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
        <div class="bg-white rounded shadow p-6">
          <h1 class="text-2xl font-bold mb-4">✅ Painel Admin</h1>
          <p class="mb-4">Total: <strong>${artigos.length}</strong> artigos</p>
          <div class="flex gap-3">
            <a href="/admin/novo" class="bg-green-600 text-white px-4 py-2 rounded">📝 Novo</a>
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
        <div class="bg-white rounded shadow p-6">
          <h1 class="text-2xl font-bold mb-4">📋 Artigos</h1>
          <a href="/admin/dashboard" class="text-blue-600">← Voltar</a>
          <div class="mt-4">
            ${artigos.map(a => `
              <div class="border p-3 mb-2 rounded">
                <div class="flex justify-between">
                  <div>
                    <h3 class="font-bold">${a.titulo}</h3>
                    <p class="text-sm text-gray-500">${a.categoria} | ${a.autor}</p>
                  </div>
                  <a href="/artigo/${a.slug}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ver</a>
                </div>
              </div>
            `).join('')}
            ${artigos.length === 0 ? '<p class="text-gray-500">Nenhum artigo</p>' : ''}
          </div>
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
        <div class="bg-white rounded shadow p-6">
          <h1 class="text-2xl font-bold mb-4">✏️ Novo Artigo</h1>
          <form method="POST" action="/admin/novo">
            <input type="text" name="titulo" placeholder="Título" class="w-full p-3 border rounded mb-3" required>
            <select name="categoria" class="w-full p-3 border rounded mb-3">
              <option value="Tecnologia">Tecnologia</option>
              <option value="Marketing">Marketing</option>
              <option value="Produtividade">Produtividade</option>
            </select>
            <input type="text" name="autor" placeholder="Autor" value="Admin" class="w-full p-3 border rounded mb-3">
            <input type="text" name="imagem" placeholder="URL da imagem" class="w-full p-3 border rounded mb-3">
            <textarea name="conteudo" rows="12" class="w-full p-3 border rounded font-mono" placeholder="Conteúdo do artigo (HTML permitido)" required></textarea>
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
    console.log('📝 Recebido:', req.body);
    
    if (!req.body.titulo || !req.body.conteudo) {
      throw new Error('Título e conteúdo são obrigatórios');
    }
    
    const artigo = await criarArtigo({
      titulo: req.body.titulo,
      conteudo: req.body.conteudo,
      categoria: req.body.categoria,
      autor: req.body.autor,
      imagem: req.body.imagem
    });
    
    console.log('✅ Artigo criado:', artigo.slug);
    res.redirect('/admin/lista');
  } catch (err) {
    console.error('❌ Erro:', err);
    res.status(500).send(`
      <h1>Erro</h1>
      <pre>${err.message}</pre>
      <a href="/admin/novo">Voltar</a>
    `);
  }
});

// =================================================================
// DEBUG
// =================================================================
app.get('/debug', async (req, res) => {
  try {
    const r = await getRedis();
    const artigos = await listarArtigos();
    res.json({
      totalArtigos: artigos.length,
      artigos: artigos.map(a => ({ titulo: a.titulo, slug: a.slug }))
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// =================================================================
// START
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}
