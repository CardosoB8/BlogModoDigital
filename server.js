const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CONECTAR REDIS
const redis = createClient({
  url: 'redis://default:JyefUsxHJljfdvs8HACumEyLE7XNgLvG@redis-19242.c266.us-east-1-3.ec2.cloud.redislabs.com:19242'
});
redis.on('error', (err) => console.log('Redis erro:', err.message));
redis.connect().then(() => console.log('✅ Redis conectado'));

// FUNÇÃO PARA SALVAR ARTIGO
async function salvarArtigo(titulo, conteudo, categoria, autor, imagem) {
  const slug = titulo.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const data = {
    titulo, conteudo, categoria, autor,
    imagem: imagem || 'https://picsum.photos/id/1/800/400',
    data: new Date().toISOString(),
    views: '0'
  };
  await redis.set(`artigo:${slug}`, JSON.stringify(data));
  await redis.lPush('artigos:lista', slug);
  return slug;
}

// FUNÇÃO PARA LISTAR ARTIGOS
async function listarArtigos() {
  const slugs = await redis.lRange('artigos:lista', 0, 99);
  const artigos = [];
  for (const slug of slugs) {
    const dados = await redis.get(`artigo:${slug}`);
    if (dados) artigos.push({ slug, ...JSON.parse(dados) });
  }
  return artigos;
}

// FUNÇÃO PARA BUSCAR ARTIGO
async function buscarArtigo(slug) {
  const dados = await redis.get(`artigo:${slug}`);
  if (!dados) return null;
  const artigo = JSON.parse(dados);
  const views = parseInt(artigo.views) + 1;
  artigo.views = views.toString();
  await redis.set(`artigo:${slug}`, JSON.stringify(artigo));
  return artigo;
}

// =============================================================
// PÁGINA INICIAL - HTML BONITO
// =============================================================
app.get('/', async (req, res) => {
  const artigos = await listarArtigos();
  
  let listaArtigos = '';
  for (const a of artigos) {
    listaArtigos += `
      <div class="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition">
        <img src="${a.imagem}" class="w-full h-48 object-cover">
        <div class="p-6">
          <span class="text-xs text-blue-600 font-semibold">${a.categoria}</span>
          <h2 class="text-xl font-bold mt-2 mb-2">
            <a href="/artigo/${a.slug}" class="hover:text-blue-600">${a.titulo}</a>
          </h2>
          <p class="text-gray-600 text-sm">${a.conteudo.replace(/<[^>]*>/g, '').substring(0, 120)}...</p>
          <div class="flex justify-between mt-4 text-xs text-gray-500">
            <span>👤 ${a.autor}</span>
            <span>📅 ${new Date(a.data).toLocaleDateString('pt-BR')}</span>
            <span>👁️ ${a.views}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ModoDigital - Blog de Tecnologia</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-gray-50">
  <header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex justify-between items-center">
      <a href="/" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ModoDigital</a>
      <div class="flex gap-4">
        <a href="/categoria/Tecnologia" class="text-gray-600 hover:text-blue-600">Tecnologia</a>
        <a href="/categoria/Marketing" class="text-gray-600 hover:text-blue-600">Marketing</a>
        <a href="/categoria/Produtividade" class="text-gray-600 hover:text-blue-600">Produtividade</a>
        <a href="/admin" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Admin</a>
      </div>
    </div>
  </header>
  
  <main class="container mx-auto px-4 py-12">
    <div class="text-center mb-12">
      <h1 class="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ModoDigital</h1>
      <p class="text-xl text-gray-600">Dicas e tutoriais para sua vida digital</p>
    </div>
    
    <div class="grid md:grid-cols-3 gap-6">
      ${listaArtigos || '<div class="col-span-3 text-center py-12"><p class="text-gray-500">Nenhum artigo ainda. <a href="/admin" class="text-blue-600">Crie o primeiro!</a></p></div>'}
    </div>
  </main>
  
  <footer class="bg-gray-900 text-white mt-12 py-8 text-center">
    <p>&copy; 2026 ModoDigital</p>
  </footer>
</body>
</html>
  `);
});

// =============================================================
// PÁGINA DO ARTIGO
// =============================================================
app.get('/artigo/:slug', async (req, res) => {
  const artigo = await buscarArtigo(req.params.slug);
  if (!artigo) return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
  
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${artigo.titulo} | ModoDigital</title>
  <meta property="og:title" content="${artigo.titulo}">
  <meta property="og:image" content="${artigo.imagem}">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <header class="bg-white shadow-sm">
    <div class="container mx-auto px-4 py-4 flex justify-between">
      <a href="/" class="text-2xl font-bold text-blue-600">ModoDigital</a>
      <a href="/admin" class="text-gray-600">Admin</a>
    </div>
  </header>
  
  <main class="container mx-auto px-4 py-8 max-w-4xl">
    <article class="bg-white rounded-2xl shadow-md p-8">
      <h1 class="text-4xl font-bold mb-4">${artigo.titulo}</h1>
      <div class="flex gap-4 text-sm text-gray-500 mb-6">
        <span>👤 ${artigo.autor}</span>
        <span>📅 ${new Date(artigo.data).toLocaleDateString('pt-BR')}</span>
        <span>👁️ ${artigo.views} visualizações</span>
      </div>
      <img src="${artigo.imagem}" class="w-full rounded-xl mb-6">
      <div class="prose max-w-none text-gray-700 leading-relaxed">${artigo.conteudo}</div>
    </article>
    <div class="text-center mt-8">
      <a href="/" class="text-blue-600">← Voltar</a>
    </div>
  </main>
</body>
</html>
  `);
});

// =============================================================
// CATEGORIAS
// =============================================================
app.get('/categoria/:cat', async (req, res) => {
  const artigos = await listarArtigos();
  const filtrados = artigos.filter(a => a.categoria === req.params.cat);
  
  let lista = '';
  for (const a of filtrados) {
    lista += `
      <div class="bg-white rounded-xl shadow p-4">
        <h2><a href="/artigo/${a.slug}" class="text-xl font-bold hover:text-blue-600">${a.titulo}</a></h2>
        <p class="text-gray-500 text-sm mt-2">${new Date(a.data).toLocaleDateString('pt-BR')}</p>
      </div>
    `;
  }
  
  res.send(`
<!DOCTYPE html>
<html>
<head><title>${req.params.cat} | ModoDigital</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <a href="/" class="text-blue-600">← Voltar</a>
    <h1 class="text-3xl font-bold mt-4 mb-6">📁 ${req.params.cat}</h1>
    <div class="space-y-3">${lista || '<p>Nenhum artigo nesta categoria.</p>'}</div>
  </div>
</body>
</html>
  `);
});

// =============================================================
// ADMIN - SIMPLES
// =============================================================
let adminLogado = false;

app.get('/admin', (req, res) => {
  if (adminLogado) return res.redirect('/admin/dashboard');
  res.send(`
<!DOCTYPE html>
<html>
<head><title>Login</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100 flex items-center justify-center min-h-screen">
  <div class="bg-white p-8 rounded-2xl shadow w-96">
    <h1 class="text-2xl font-bold text-center mb-6">Login Admin</h1>
    <form method="POST" action="/admin/login">
      <input type="password" name="senha" placeholder="Senha" class="w-full p-3 border rounded-xl mb-4">
      <button class="w-full bg-blue-600 text-white p-3 rounded-xl">Entrar</button>
    </form>
  </div>
</body>
</html>
  `);
});

app.post('/admin/login', (req, res) => {
  if (req.body.senha === 'admin123') {
    adminLogado = true;
    res.redirect('/admin/dashboard');
  } else {
    res.send('<h1>Senha errada</h1><a href="/admin">Voltar</a>');
  }
});

app.get('/admin/logout', (req, res) => {
  adminLogado = false;
  res.redirect('/');
});

app.get('/admin/dashboard', async (req, res) => {
  if (!adminLogado) return res.redirect('/admin');
  const artigos = await listarArtigos();
  
  let listaAdmin = '';
  for (const a of artigos) {
    listaAdmin += `
      <div class="border p-3 rounded mb-2 flex justify-between">
        <div><strong>${a.titulo}</strong><br><small>${a.categoria} | ${a.autor}</small></div>
        <a href="/artigo/${a.slug}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ver</a>
      </div>
    `;
  }
  
  res.send(`
<!DOCTYPE html>
<html>
<head><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8">
    <div class="bg-white rounded-2xl shadow p-6">
      <h1 class="text-2xl font-bold mb-4">Painel Admin</h1>
      <p class="mb-4">Total: <strong>${artigos.length}</strong> artigos</p>
      <div class="flex gap-3 mb-6">
        <a href="/admin/novo" class="bg-green-600 text-white px-4 py-2 rounded">➕ Novo Artigo</a>
        <a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a>
      </div>
      <h2 class="font-bold mb-2">Artigos:</h2>
      ${listaAdmin || '<p>Nenhum artigo</p>'}
    </div>
  </div>
</body>
</html>
  `);
});

app.get('/admin/novo', (req, res) => {
  if (!adminLogado) return res.redirect('/admin');
  res.send(`
<!DOCTYPE html>
<html>
<head><title>Novo Artigo</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <div class="bg-white rounded-2xl shadow p-6">
      <h1 class="text-2xl font-bold mb-4">✏️ Criar Artigo</h1>
      <form method="POST" action="/admin/novo">
        <input type="text" name="titulo" placeholder="Título" class="w-full p-3 border rounded-xl mb-3" required>
        <select name="categoria" class="w-full p-3 border rounded-xl mb-3">
          <option value="Tecnologia">Tecnologia</option>
          <option value="Marketing">Marketing</option>
          <option value="Produtividade">Produtividade</option>
        </select>
        <input type="text" name="autor" placeholder="Autor" value="Admin" class="w-full p-3 border rounded-xl mb-3">
        <input type="text" name="imagem" placeholder="URL da imagem (deixe em branco)" class="w-full p-3 border rounded-xl mb-3">
        <textarea name="conteudo" rows="10" placeholder="Conteúdo do artigo (HTML permitido)" class="w-full p-3 border rounded-xl mb-3" required></textarea>
        <div class="flex gap-3">
          <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-xl">Publicar</button>
          <a href="/admin/dashboard" class="bg-gray-500 text-white px-6 py-2 rounded-xl">Cancelar</a>
        </div>
      </form>
    </div>
  </div>
</body>
</html>
  `);
});

app.post('/admin/novo', async (req, res) => {
  if (!adminLogado) return res.redirect('/admin');
  await salvarArtigo(
    req.body.titulo,
    req.body.conteudo,
    req.body.categoria,
    req.body.autor,
    req.body.imagem
  );
  res.redirect('/admin/dashboard');
});

// =============================================================
// INICIAR
// =============================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(3000, () => console.log('🚀 http://localhost:3000'));
}
