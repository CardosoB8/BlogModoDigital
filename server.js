const express = require('express');
const session = require('express-session');
const { createClient } = require('redis');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'mododigital-secret',
  resave: false,
  saveUninitialized: false
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
    await redis.connect();
    console.log('✅ Redis conectado');
  }
  return redis;
}

// =================================================================
// FUNÇÕES
// =================================================================
async function salvarArtigo(dados) {
  const r = await getRedis();
  const slug = slugify(dados.titulo, { lower: true, strict: true });
  const agora = new Date().toISOString();
  
  // Criar resumo seguro
  let resumo = dados.conteudo || '';
  resumo = resumo.replace(/<[^>]*>/g, '').substring(0, 160);
  if (!resumo) resumo = 'Artigo sem resumo';
  
  const artigo = {
    id: uuidv4(),
    slug: slug,
    titulo: dados.titulo || 'Sem título',
    conteudo: dados.conteudo || '<p>Conteúdo vazio</p>',
    resumo: resumo,
    imagem: dados.imagem || 'https://picsum.photos/id/1/1200/630',
    autor: dados.autor || 'Admin',
    categoria: dados.categoria || 'Tecnologia',
    criado: agora,
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
    'criado', artigo.criado,
    'views', artigo.views
  );
  
  await r.zAdd('artigos:lista', { score: Date.now(), value: slug });
  
  return artigo;
}

async function listarArtigos() {
  const r = await getRedis();
  const slugs = await r.zRange('artigos:lista', 0, -1);
  const artigos = [];
  
  for (const slug of slugs.reverse()) {
    const a = await r.hGetAll(`artigo:${slug}`);
    if (a && a.titulo) {
      artigos.push(a);
    }
  }
  return artigos;
}

async function buscarArtigo(slug) {
  const r = await getRedis();
  const a = await r.hGetAll(`artigo:${slug}`);
  if (!a || !a.titulo) return null;
  
  const views = parseInt(a.views || '0') + 1;
  await r.hSet(`artigo:${slug}`, 'views', views.toString());
  a.views = views.toString();
  
  return a;
}

// =================================================================
// ROTAS
// =================================================================

// Home
app.get('/', async (req, res) => {
  try {
    const artigos = await listarArtigos();
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ModoDigital - Blog</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <header class="bg-white shadow">
    <div class="container mx-auto px-4 py-4 flex justify-between">
      <a href="/" class="text-2xl font-bold text-blue-600">ModoDigital</a>
      <a href="/admin" class="text-gray-600">Admin</a>
    </div>
  </header>
  
  <main class="container mx-auto px-4 py-8">
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold">ModoDigital</h1>
      <p class="text-gray-600 mt-2">Dicas e tutoriais para sua vida digital</p>
    </div>
    
    <div class="grid md:grid-cols-3 gap-6">
    `;
    
    for (const a of artigos) {
      html += `
      <div class="bg-white rounded-lg shadow overflow-hidden">
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
            <span>👁️ ${a.views}</span>
          </div>
        </div>
      </div>
      `;
    }
    
    if (artigos.length === 0) {
      html += `
      <div class="col-span-3 text-center py-12">
        <p class="text-gray-500">Nenhum artigo publicado ainda.</p>
        <a href="/admin/novo" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded">Criar primeiro artigo</a>
      </div>
      `;
    }
    
    html += `
    </div>
  </main>
  
  <footer class="bg-gray-800 text-white mt-12 py-6 text-center text-sm">
    &copy; 2026 ModoDigital
  </footer>
</body>
</html>
    `;
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Erro: ${err.message}`);
  }
});

// Artigo
app.get('/artigo/:slug', async (req, res) => {
  try {
    const a = await buscarArtigo(req.params.slug);
    if (!a) return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${a.titulo} | ModoDigital</title>
  <meta name="description" content="${a.resumo}">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <header class="bg-white shadow">
    <div class="container mx-auto px-4 py-4 flex justify-between">
      <a href="/" class="text-2xl font-bold text-blue-600">ModoDigital</a>
      <a href="/admin" class="text-gray-600">Admin</a>
    </div>
  </header>
  
  <main class="container mx-auto px-4 py-8 max-w-4xl">
    <article class="bg-white rounded-lg shadow p-8">
      <h1 class="text-3xl font-bold mb-4">${a.titulo}</h1>
      <div class="flex gap-4 text-sm text-gray-500 mb-6">
        <span>👤 ${a.autor}</span>
        <span>📅 ${new Date(a.criado).toLocaleDateString('pt-BR')}</span>
        <span>👁️ ${a.views}</span>
      </div>
      <img src="${a.imagem}" class="w-full rounded-lg mb-6">
      <div class="prose max-w-none">${a.conteudo}</div>
    </article>
    <div class="mt-6 text-center">
      <a href="/" class="text-blue-600">← Voltar</a>
    </div>
  </main>
  
  <footer class="bg-gray-800 text-white mt-12 py-6 text-center text-sm">
    &copy; 2026 ModoDigital
  </footer>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send(`Erro: ${err.message}`);
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
  <div class="bg-white p-8 rounded shadow w-96">
    <h1 class="text-2xl font-bold text-center mb-6">Login Admin</h1>
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
    res.send('<h1>Senha errada</h1><a href="/admin/login">Tentar</a>');
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
      <h1 class="text-2xl font-bold mb-4">Painel Admin</h1>
      <p class="mb-4">Total: <strong>${artigos.length}</strong> artigos</p>
      <div class="flex gap-3">
        <a href="/admin/novo" class="bg-green-600 text-white px-4 py-2 rounded">➕ Novo Artigo</a>
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
  
  let html = `
<!DOCTYPE html>
<html>
<head><title>Artigos</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8">
    <div class="bg-white rounded shadow p-6">
      <h1 class="text-2xl font-bold mb-4">📋 Artigos</h1>
      <a href="/admin/dashboard" class="text-blue-600">← Voltar</a>
      <div class="mt-4 space-y-2">
  `;
  
  for (const a of artigos) {
    html += `
      <div class="border p-3 rounded flex justify-between items-center">
        <div>
          <h3 class="font-bold">${a.titulo}</h3>
          <p class="text-sm text-gray-500">${a.categoria} | ${a.autor}</p>
        </div>
        <div class="flex gap-2">
          <a href="/artigo/${a.slug}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ver</a>
        </div>
      </div>
    `;
  }
  
  if (artigos.length === 0) html += '<p class="text-gray-500">Nenhum artigo</p>';
  
  html += `
      </div>
    </div>
  </div>
</body>
</html>
  `;
  
  res.send(html);
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
        <input type="text" name="imagem" placeholder="URL da imagem (deixe em branco para padrão)" class="w-full p-3 border rounded mb-3">
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
    await salvarArtigo({
      titulo: req.body.titulo,
      conteudo: req.body.conteudo,
      categoria: req.body.categoria,
      autor: req.body.autor,
      imagem: req.body.imagem
    });
    res.redirect('/admin/lista');
  } catch (err) {
    res.status(500).send(`Erro: ${err.message}<br><a href="/admin/novo">Voltar</a>`);
  }
});

// =================================================================
// DEBUG
// =================================================================
app.get('/debug', async (req, res) => {
  try {
    const artigos = await listarArtigos();
    res.json({ total: artigos.length, artigos: artigos.map(a => ({ titulo: a.titulo, slug: a.slug })) });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// =================================================================
// EXPORT
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(3000, () => console.log('🚀 Servidor rodando'));
}
