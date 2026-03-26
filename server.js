const express = require('express');
const session = require('express-session');
const { createClient } = require('redis');
const slugify = require('slugify');

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
    redis.on('connect', () => console.log('✅ Redis conectado'));
    await redis.connect();
  }
  return redis;
}

// =================================================================
// SALVAR DIRETO
// =================================================================
app.post('/salvar', async (req, res) => {
  try {
    const r = await getRedis();
    const { titulo, conteudo } = req.body;
    
    console.log('📝 Recebido:', titulo);
    
    const slug = slugify(titulo, { lower: true, strict: true });
    const agora = new Date().toISOString();
    
    // Salvar direto
    await r.set(`teste:${slug}`, JSON.stringify({
      titulo: titulo,
      conteudo: conteudo,
      criado: agora
    }));
    
    // Listar todas as chaves
    const keys = await r.keys('*');
    
    res.json({ 
      ok: true, 
      slug: slug,
      todasChaves: keys 
    });
    
  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

// =================================================================
// LISTAR TESTES
// =================================================================
app.get('/listar', async (req, res) => {
  try {
    const r = await getRedis();
    const keys = await r.keys('*');
    const itens = [];
    
    for (const key of keys) {
      const valor = await r.get(key);
      try {
        itens.push({ key, valor: JSON.parse(valor) });
      } catch {
        itens.push({ key, valor: valor });
      }
    }
    
    res.json({ total: keys.length, itens });
    
  } catch (err) {
    res.json({ erro: err.message });
  }
});

// =================================================================
// LIMPAR TUDO
// =================================================================
app.get('/limpar', async (req, res) => {
  try {
    const r = await getRedis();
    const keys = await r.keys('*');
    for (const key of keys) {
      await r.del(key);
    }
    res.json({ ok: true, removidos: keys.length });
  } catch (err) {
    res.json({ erro: err.message });
  }
});

// =================================================================
// FORMULÁRIO SIMPLES
// =================================================================
app.get('/teste', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Teste Redis</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 p-8">
      <div class="max-w-2xl mx-auto bg-white p-6 rounded shadow">
        <h1 class="text-2xl font-bold mb-4">🧪 Teste de Salvamento no Redis</h1>
        
        <form id="form">
          <input type="text" id="titulo" placeholder="Título" class="w-full p-3 border rounded mb-3">
          <textarea id="conteudo" rows="5" placeholder="Conteúdo" class="w-full p-3 border rounded mb-3"></textarea>
          <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
        </form>
        
        <div id="resultado" class="mt-4 p-3 bg-gray-100 rounded hidden"></div>
        
        <div class="mt-6">
          <a href="/listar" target="_blank" class="text-blue-600">Ver todos os dados</a>
          <span class="mx-2">|</span>
          <a href="/limpar" class="text-red-600" onclick="return confirm('Limpar tudo?')">Limpar Redis</a>
        </div>
      </div>
      
      <script>
        document.getElementById('form').onsubmit = async (e) => {
          e.preventDefault();
          
          const titulo = document.getElementById('titulo').value;
          const conteudo = document.getElementById('conteudo').value;
          
          if (!titulo) {
            alert('Digite um título');
            return;
          }
          
          const res = await fetch('/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo, conteudo })
          });
          
          const data = await res.json();
          
          const div = document.getElementById('resultado');
          div.classList.remove('hidden');
          div.innerHTML = \`
            <strong>✅ Salvo!</strong><br>
            Slug: \${data.slug}<br>
            Todas chaves no Redis: \${data.todasChaves?.join(', ')}
          \`;
          
          document.getElementById('titulo').value = '';
          document.getElementById('conteudo').value = '';
        };
      </script>
    </body>
    </html>
  `);
});

// =================================================================
// ADMIN SIMPLES
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
        <h1 class="text-2xl font-bold text-center mb-6">Login</h1>
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
    res.send('Senha errada <a href="/admin/login">Voltar</a>');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  
  const r = await getRedis();
  const keys = await r.keys('*');
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8">
        <div class="bg-white rounded shadow p-6">
          <h1 class="text-2xl font-bold mb-4">Painel Admin</h1>
          <p>Chaves no Redis: <strong>${keys.length}</strong></p>
          <div class="flex gap-3 mt-4">
            <a href="/teste" class="bg-green-600 text-white px-4 py-2 rounded">📝 Testar Salvamento</a>
            <a href="/listar" class="bg-blue-600 text-white px-4 py-2 rounded">📋 Ver Dados</a>
            <a href="/" class="bg-gray-600 text-white px-4 py-2 rounded">🌐 Site</a>
            <a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// =================================================================
// HOME
// =================================================================
app.get('/', async (req, res) => {
  try {
    const r = await getRedis();
    const keys = await r.keys('*');
    const artigos = [];
    
    for (const key of keys) {
      if (key.startsWith('teste:')) {
        const valor = await r.get(key);
        try {
          const artigo = JSON.parse(valor);
          artigos.push({
            slug: key.replace('teste:', ''),
            titulo: artigo.titulo,
            conteudo: artigo.conteudo,
            criado: artigo.criado
          });
        } catch(e) {}
      }
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ModoDigital</title>
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
            ${artigos.map(a => `
              <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="p-5">
                  <span class="text-xs text-blue-600">Artigo</span>
                  <h2 class="text-xl font-bold mt-2">
                    <a href="/artigo/${a.slug}" class="hover:text-blue-600">${a.titulo}</a>
                  </h2>
                  <p class="text-gray-600 text-sm mt-2">${(a.conteudo || '').substring(0, 100)}...</p>
                  <div class="text-xs text-gray-500 mt-3">
                    ${new Date(a.criado).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${artigos.length === 0 ? `
            <div class="text-center py-12">
              <p class="text-gray-500">Nenhum artigo ainda.</p>
              <a href="/teste" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded">Criar primeiro artigo de teste</a>
            </div>
          ` : ''}
        </main>
        
        <footer class="bg-gray-800 text-white mt-12 py-6 text-center text-sm">
          &copy; 2026 ModoDigital
        </footer>
      </body>
      </html>
    `);
  } catch (err) {
    res.send(`<h1>Erro: ${err.message}</h1>`);
  }
});

// =================================================================
// VER ARTIGO
// =================================================================
app.get('/artigo/:slug', async (req, res) => {
  try {
    const r = await getRedis();
    const valor = await r.get(`teste:${req.params.slug}`);
    
    if (!valor) {
      return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
    }
    
    const artigo = JSON.parse(valor);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${artigo.titulo} | ModoDigital</title>
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
            <h1 class="text-3xl font-bold mb-4">${artigo.titulo}</h1>
            <div class="text-sm text-gray-500 mb-6">
              📅 ${new Date(artigo.criado).toLocaleDateString('pt-BR')}
            </div>
            <div class="prose max-w-none">${artigo.conteudo}</div>
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
    res.send(`<h1>Erro: ${err.message}</h1>`);
  }
});

// =================================================================
// EXPORT
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(3000, () => console.log('🚀 Servidor em http://localhost:3000'));
}
