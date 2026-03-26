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
// FUNÇÕES DOS ARTIGOS
// =================================================================
async function salvarArtigo(dados) {
  const r = await getRedis();
  const slug = slugify(dados.titulo, { lower: true, strict: true });
  const id = uuidv4();
  const agora = new Date().toISOString();
  
  // Resumo seguro
  let resumo = dados.conteudo || '';
  resumo = resumo.replace(/<[^>]*>/g, '').substring(0, 160);
  if (!resumo) resumo = 'Sem resumo';
  
  const artigo = {
    id: id,
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

async function getArtigosPorCategoria(categoria) {
  const todos = await listarArtigos();
  return todos.filter(a => a.categoria === categoria);
}

async function getArtigosRelacionados(categoria, slugAtual, limite = 3) {
  const todos = await listarArtigos();
  return todos.filter(a => a.categoria === categoria && a.slug !== slugAtual).slice(0, limite);
}

// =================================================================
// PÁGINA INICIAL
// =================================================================
app.get('/', async (req, res) => {
  try {
    const artigos = await listarArtigos();
    
    let html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ModoDigital - Blog de Tecnologia e Marketing</title>
  <meta name="description" content="Dicas e tutoriais para sua vida digital. Tecnologia, marketing e produtividade.">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .card-hover { transition: transform 0.2s; }
    .card-hover:hover { transform: translateY(-4px); }
  </style>
</head>
<body class="bg-gray-50">
  <header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex justify-between items-center">
      <a href="/" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ModoDigital</a>
      <div class="flex gap-4">
        <a href="/categoria/Tecnologia" class="text-gray-600 hover:text-blue-600 hidden md:block">Tecnologia</a>
        <a href="/categoria/Marketing" class="text-gray-600 hover:text-blue-600 hidden md:block">Marketing</a>
        <a href="/categoria/Produtividade" class="text-gray-600 hover:text-blue-600 hidden md:block">Produtividade</a>
        <a href="/admin" class="text-gray-600 hover:text-blue-600">🔐 Admin</a>
      </div>
    </div>
  </header>
  
  <main class="container mx-auto px-4 py-8">
    <div class="text-center mb-12">
      <h1 class="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ModoDigital</h1>
      <p class="text-xl text-gray-600">Dicas e tutoriais para sua vida digital</p>
    </div>
    
    <div class="grid md:grid-cols-3 gap-6">
    `;
    
    for (const a of artigos) {
      const data = new Date(a.criado).toLocaleDateString('pt-BR');
      html += `
      <div class="bg-white rounded-xl shadow-md overflow-hidden card-hover">
        <img src="${a.imagem}" class="w-full h-48 object-cover" alt="${a.titulo}">
        <div class="p-5">
          <span class="text-xs text-blue-600 font-semibold">${a.categoria}</span>
          <h2 class="text-xl font-bold mt-2 mb-2">
            <a href="/artigo/${a.slug}" class="hover:text-blue-600">${a.titulo}</a>
          </h2>
          <p class="text-gray-600 text-sm">${a.resumo.substring(0, 100)}...</p>
          <div class="flex justify-between items-center mt-4 text-xs text-gray-500">
            <span>👤 ${a.autor}</span>
            <span>📅 ${data}</span>
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
        <a href="/admin/novo" class="inline-block mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">📝 Criar primeiro artigo</a>
      </div>
      `;
    }
    
    html += `
    </div>
  </main>
  
  <footer class="bg-gray-900 text-gray-300 mt-12 py-8">
    <div class="container mx-auto px-4 text-center text-sm">
      &copy; 2026 ModoDigital - Todos os direitos reservados
    </div>
  </footer>
</body>
</html>
    `;
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Erro</h1><pre>${err.message}</pre>`);
  }
});

// =================================================================
// PÁGINA DO ARTIGO
// =================================================================
app.get('/artigo/:slug', async (req, res) => {
  try {
    const artigo = await buscarArtigo(req.params.slug);
    if (!artigo) {
      return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
    }
    
    const relacionados = await getArtigosRelacionados(artigo.categoria, artigo.slug);
    const data = new Date(artigo.criado).toLocaleDateString('pt-BR');
    
    let relacionadosHtml = '';
    if (relacionados.length > 0) {
      relacionadosHtml = `
      <div class="mt-8">
        <h3 class="text-xl font-bold mb-4">📖 Artigos Relacionados</h3>
        <div class="grid md:grid-cols-3 gap-4">
      `;
      for (const rel of relacionados) {
        relacionadosHtml += `
          <a href="/artigo/${rel.slug}" class="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
            <h4 class="font-semibold hover:text-blue-600">${rel.titulo}</h4>
            <p class="text-xs text-gray-500 mt-1">${new Date(rel.criado).toLocaleDateString('pt-BR')}</p>
          </a>
        `;
      }
      relacionadosHtml += `</div></div>`;
    }
    
    res.send(`
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${artigo.titulo} | ModoDigital</title>
  <meta name="description" content="${artigo.resumo}">
  <meta property="og:title" content="${artigo.titulo}">
  <meta property="og:description" content="${artigo.resumo}">
  <meta property="og:image" content="${artigo.imagem}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .article-content { line-height: 1.8; }
    .article-content p { margin-bottom: 1rem; }
    .article-content h2 { font-size: 1.5rem; margin: 1.5rem 0 1rem; font-weight: bold; }
    .article-content h3 { font-size: 1.25rem; margin: 1.2rem 0 0.8rem; font-weight: bold; }
    .article-content img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    .article-content ul, .article-content ol { margin: 1rem 0 1rem 2rem; }
    .article-content li { margin: 0.25rem 0; }
    .article-content blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 1rem 0; color: #4b5563; }
    .article-content a { color: #3b82f6; text-decoration: underline; }
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
      <div class="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
        <span>👤 ${artigo.autor}</span>
        <span>📅 ${data}</span>
        <span>👁️ ${artigo.views} visualizações</span>
        <span>🏷️ ${artigo.categoria}</span>
      </div>
      <img src="${artigo.imagem}" class="w-full rounded-lg mb-6" alt="${artigo.titulo}">
      <div class="article-content">${artigo.conteudo}</div>
    </article>
    
    ${relacionadosHtml}
    
    <div class="mt-8 text-center">
      <a href="/" class="text-blue-600 hover:underline">← Voltar para o início</a>
    </div>
  </main>
  
  <footer class="bg-gray-900 text-gray-300 mt-12 py-8 text-center text-sm">
    &copy; 2026 ModoDigital - Todos os direitos reservados
  </footer>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Erro</h1><pre>${err.message}</pre>`);
  }
});

// =================================================================
// CATEGORIAS
// =================================================================
app.get('/categoria/:nome', async (req, res) => {
  try {
    const artigos = await getArtigosPorCategoria(req.params.nome);
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${req.params.nome} | ModoDigital</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <header class="bg-white shadow-sm">
    <div class="container mx-auto px-4 py-4 flex justify-between">
      <a href="/" class="text-2xl font-bold text-blue-600">ModoDigital</a>
      <a href="/admin" class="text-gray-600">Admin</a>
    </div>
  </header>
  
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">📁 ${req.params.nome}</h1>
    <a href="/" class="text-blue-600 mb-4 inline-block">← Voltar</a>
    
    <div class="grid md:grid-cols-3 gap-6 mt-4">
      ${artigos.map(a => `
        <div class="bg-white rounded-lg shadow p-4">
          <h2 class="text-lg font-bold">
            <a href="/artigo/${a.slug}" class="hover:text-blue-600">${a.titulo}</a>
          </h2>
          <p class="text-sm text-gray-500 mt-2">${new Date(a.criado).toLocaleDateString('pt-BR')}</p>
        </div>
      `).join('')}
    </div>
    ${artigos.length === 0 ? '<p class="text-center text-gray-500 mt-8">Nenhum artigo nesta categoria.</p>' : ''}
  </main>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send(`Erro: ${err.message}`);
  }
});

// =================================================================
// ADMIN - DASHBOARD
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
    <h1 class="text-2xl font-bold text-center mb-6">🔐 Login Admin</h1>
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
      <h1 class="text-2xl font-bold mb-4">✅ Painel Administrativo</h1>
      <p class="mb-4">Total de artigos: <strong>${artigos.length}</strong></p>
      <div class="bg-green-100 p-3 rounded mb-4">✅ Redis Cloud conectado!</div>
      <div class="flex gap-3 flex-wrap">
        <a href="/admin/novo" class="bg-green-600 text-white px-4 py-2 rounded">📝 Novo Artigo</a>
        <a href="/admin/lista" class="bg-blue-600 text-white px-4 py-2 rounded">📋 Listar Artigos</a>
        <a href="/" class="bg-gray-600 text-white px-4 py-2 rounded">🌐 Ver Site</a>
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
      <h1 class="text-2xl font-bold mb-4">📋 Todos os Artigos</h1>
      <a href="/admin/dashboard" class="text-blue-600">← Voltar</a>
      <div class="mt-4 space-y-2">
  `;
  
  for (const a of artigos) {
    html += `
      <div class="border p-3 rounded flex justify-between items-center">
        <div>
          <h3 class="font-bold">${a.titulo}</h3>
          <p class="text-sm text-gray-500">${a.categoria} | ${a.autor} | ${new Date(a.criado).toLocaleDateString('pt-BR')} | 👁️ ${a.views}</p>
        </div>
        <div class="flex gap-2">
          <a href="/artigo/${a.slug}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ver</a>
        </div>
      </div>
    `;
  }
  
  if (artigos.length === 0) html += '<p class="text-gray-500">Nenhum artigo criado ainda.</p>';
  
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
      <h1 class="text-2xl font-bold mb-4">✏️ Criar Novo Artigo</h1>
      <form method="POST" action="/admin/novo">
        <div class="mb-4">
          <label class="block font-bold mb-2">Título *</label>
          <input type="text" name="titulo" class="w-full p-3 border rounded" required>
        </div>
        
        <div class="mb-4">
          <label class="block font-bold mb-2">Categoria</label>
          <select name="categoria" class="w-full p-3 border rounded">
            <option value="Tecnologia">Tecnologia</option>
            <option value="Marketing">Marketing</option>
            <option value="Produtividade">Produtividade</option>
          </select>
        </div>
        
        <div class="mb-4">
          <label class="block font-bold mb-2">Autor</label>
          <input type="text" name="autor" value="Admin" class="w-full p-3 border rounded">
        </div>
        
        <div class="mb-4">
          <label class="block font-bold mb-2">URL da Imagem (opcional)</label>
          <input type="text" name="imagem" placeholder="https://picsum.photos/id/1/1200/630" class="w-full p-3 border rounded">
        </div>
        
        <div class="mb-4">
          <label class="block font-bold mb-2">Conteúdo *</label>
          <textarea name="conteudo" rows="12" class="w-full p-3 border rounded font-mono" placeholder="&lt;p&gt;Seu conteúdo aqui...&lt;/p&gt;&#10;&lt;h2&gt;Subtítulo&lt;/h2&gt;&#10;&lt;p&gt;Mais conteúdo...&lt;/p&gt;" required></textarea>
          <p class="text-xs text-gray-500 mt-1">Você pode usar HTML: &lt;p&gt;, &lt;h2&gt;, &lt;img&gt;, &lt;ul&gt;, &lt;li&gt;, etc.</p>
        </div>
        
        <div class="flex gap-3">
          <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">📤 Publicar Artigo</button>
          <a href="/admin/dashboard" class="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600">Cancelar</a>
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
    const artigo = await salvarArtigo({
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
    res.status(500).send(`<h1>Erro ao criar artigo</h1><pre>${err.message}</pre><a href="/admin/novo">Voltar</a>`);
  }
});

// =================================================================
// DEBUG
// =================================================================
app.get('/debug', async (req, res) => {
  const artigos = await listarArtigos();
  res.json({ total: artigos.length, artigos: artigos.map(a => ({ titulo: a.titulo, slug: a.slug })) });
});

// =================================================================
// EXPORT
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(3000, () => console.log('🚀 Servidor em http://localhost:3000'));
}
