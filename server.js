const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Arquivo onde os posts serão salvos
const POSTS_FILE = path.join(__dirname, 'posts.json');

// Inicializar arquivo de posts se não existir
if (!fs.existsSync(POSTS_FILE)) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify([], null, 2));
}

// Função para ler posts
function lerPosts() {
  const dados = fs.readFileSync(POSTS_FILE, 'utf8');
  return JSON.parse(dados);
}

// Função para salvar posts
function salvarPosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Função para criar slug
function criarSlug(titulo) {
  return titulo.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// =============================================================
// PÁGINA INICIAL - HTML BONITO
// =============================================================
app.get('/', (req, res) => {
  const posts = lerPosts();
  
  // Ordenar por data (mais recentes primeiro)
  posts.sort((a, b) => new Date(b.data) - new Date(a.data));
  
  // Pegar os 3 primeiros para destaque
  const featured = posts.slice(0, 3);
  const outros = posts.slice(3);
  
  // Gerar HTML dos posts em destaque
  let featuredHtml = '';
  for (const post of featured) {
    featuredHtml += `
      <div class="group relative rounded-xl overflow-hidden shadow-lg h-64 md:h-72">
        <img src="${post.imagem}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
        <div class="absolute bottom-0 left-0 p-5 text-white">
          <span class="bg-primary text-xs px-2 py-1 rounded-full">${post.categoria}</span>
          <h3 class="text-xl font-bold mt-2 line-clamp-2">${post.titulo}</h3>
          <p class="text-sm opacity-90 mt-1">${new Date(post.data).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    `;
  }
  
  // Gerar HTML dos outros posts
  let postsHtml = '';
  for (const post of outros) {
    postsHtml += `
      <div class="post-card bg-white dark:bg-gray-800/70 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all flex flex-col h-full">
        <img src="${post.imagem}" loading="lazy" class="w-full h-48 object-cover" alt="${post.titulo}">
        <div class="p-5 flex flex-col flex-grow">
          <div class="flex justify-between items-center text-xs text-primary mb-2">
            <span class="bg-primary/10 px-2 py-0.5 rounded-full">${post.categoria}</span>
            <span class="text-gray-400"><i class="far fa-calendar-alt mr-1"></i>${new Date(post.data).toLocaleDateString('pt-BR')}</span>
          </div>
          <h3 class="text-xl font-bold mb-2 hover:text-primary transition">
            <a href="/post/${post.slug}">${post.titulo}</a>
          </h3>
          <p class="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 mb-3">${post.resumo}</p>
          <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
            <span class="text-xs text-gray-400"><i class="far fa-user-circle mr-1"></i> ${post.autor}</span>
            <a href="/post/${post.slug}" class="text-primary text-sm font-medium hover:underline">Leia mais <i class="fas fa-arrow-right text-xs"></i></a>
          </div>
        </div>
      </div>
    `;
  }
  
  // Gerar HTML dos posts populares (mais visualizações)
  const populares = [...posts].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 4);
  let popularesHtml = '';
  for (const post of populares) {
    popularesHtml += `
      <div class="flex gap-3 items-center">
        <img src="${post.imagem}" class="w-14 h-14 rounded-lg object-cover" alt="">
        <div>
          <a href="/post/${post.slug}" class="font-medium hover:text-primary text-sm">${post.titulo.length > 45 ? post.titulo.slice(0,42)+'...' : post.titulo}</a>
          <div class="text-xs text-gray-400">${new Date(post.data).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>
    `;
  }
  
  // Gerar tags
  const categorias = [...new Set(posts.map(p => p.categoria))];
  let tagsHtml = '';
  for (const cat of categorias) {
    tagsHtml += `<button data-filter="${cat}" class="filter-tag px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs hover:bg-primary/30 transition">#${cat}</button>`;
  }
  
  res.send(`
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ModoDigital - Blog de Tecnologia & Marketing Digital</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    body { font-family: 'Inter', sans-serif; transition: background-color 0.25s; }
    .post-card { transition: transform 0.25s, box-shadow 0.3s; }
    .post-card:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -12px rgba(0,0,0,0.1); }
    .dark .post-card { box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .mobile-menu { transition: transform 0.3s; transform: translateX(-100%); }
    .mobile-menu.open { transform: translateX(0); }
    .search-modal { transition: opacity 0.2s, visibility 0.2s, transform 0.2s; opacity: 0; visibility: hidden; transform: scale(0.96); }
    .search-modal.active { opacity: 1; visibility: visible; transform: scale(1); }
    .overlay { transition: opacity 0.25s; }
    .sticky-header { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .dark .sticky-header { background: rgba(15,23,42,0.92); backdrop-filter: blur(12px); }
    .back-to-top { transition: all 0.2s; opacity: 0; visibility: hidden; bottom: 20px; right: 20px; position: fixed; }
    .back-to-top.show { opacity: 1; visibility: visible; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; }
    .dark ::-webkit-scrollbar-track { background: #1e293b; }
    ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 8px; }
  </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 antialiased transition-colors">
  <div id="globalOverlay" class="overlay fixed inset-0 bg-black/50 dark:bg-black/70 z-40 opacity-0 invisible"></div>
  
  <header id="mainHeader" class="bg-white dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-sm">
    <div class="container mx-auto px-5 lg:px-8 flex items-center justify-between h-16 md:h-20">
      <div class="flex items-center gap-2">
        <a href="/" class="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Modo<span class="text-gray-800 dark:text-white">Digital</span></a>
      </div>
      <nav class="hidden lg:flex items-center space-x-8 text-sm font-medium">
        <a href="/" class="hover:text-blue-600 transition">Início</a>
        ${categorias.map(c => `<a href="/categoria/${c}" class="hover:text-blue-600 transition">${c}</a>`).join('')}
      </nav>
      <div class="flex items-center gap-3">
        <button id="searchToggleBtn" class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-blue-600/10 hover:text-blue-600 transition">
          <i class="fas fa-search text-sm"></i>
        </button>
        <button id="darkModeToggle" class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <i class="fas fa-moon dark:hidden"></i>
          <i class="fas fa-sun hidden dark:inline-block text-yellow-400"></i>
        </button>
        <button id="mobileMenuBtn" class="lg:hidden w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800"><i class="fas fa-bars"></i></button>
      </div>
    </div>
  </header>

  <div id="mobileDrawer" class="mobile-menu fixed top-0 left-0 w-[280px] h-full bg-white dark:bg-gray-900 z-50 shadow-2xl p-6 flex flex-col">
    <div class="flex justify-between border-b pb-3"><span class="font-bold text-xl">Menu</span><button id="closeMenuBtn"><i class="fas fa-times"></i></button></div>
    <nav class="flex flex-col gap-4 mt-6">
      <a href="/" class="hover:text-blue-600">Início</a>
      ${categorias.map(c => `<a href="/categoria/${c}" class="hover:text-blue-600">${c}</a>`).join('')}
      <a href="/admin" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-center">Admin</a>
    </nav>
  </div>

  <div id="searchModal" class="search-modal fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 p-5">
    <div class="flex justify-between border-b pb-2 mb-4"><h3 class="text-xl font-semibold">Buscar artigos</h3><button id="closeSearchBtn"><i class="fas fa-times text-xl"></i></button></div>
    <input type="text" id="searchInput" placeholder="Digite título, categoria..." class="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500">
    <div id="searchResultsPreview" class="mt-5 max-h-96 overflow-y-auto space-y-3 text-sm"></div>
  </div>

  <main class="container mx-auto px-5 lg:px-8 py-8 md:py-12">
    <div class="mb-12">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-2xl md:text-3xl font-bold border-l-4 border-blue-600 pl-3">Destaques da Semana</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${featuredHtml || '<p class="col-span-3 text-center">Nenhum post em destaque</p>'}</div>
    </div>

    <div class="flex flex-col lg:flex-row gap-10">
      <div class="lg:w-2/3 w-full">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold">Últimos Artigos</h2>
          <div class="flex gap-2 text-sm">
            <button data-filter="all" class="filter-btn px-3 py-1 rounded-full bg-blue-600/10 text-blue-600 font-medium">Todos</button>
            ${categorias.map(c => `<button data-filter="${c}" class="filter-btn px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-blue-600/20">${c}</button>`).join('')}
          </div>
        </div>
        <div id="postsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-6">${postsHtml || '<p class="col-span-2 text-center">Nenhum artigo publicado ainda</p>'}</div>
      </div>

      <aside class="lg:w-1/3 w-full space-y-8">
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <div class="flex items-center gap-2 text-blue-600 text-xl mb-2"><i class="fas fa-envelope-open-text"></i><h3 class="font-bold text-lg">Newsletter</h3></div>
          <p class="text-sm mb-4">Receba as novidades em primeira mão.</p>
          <div class="flex gap-2"><input type="email" placeholder="seu@email.com" class="flex-1 p-2 border rounded-xl dark:bg-gray-700"><button class="bg-blue-600 text-white px-4 rounded-xl">Assinar</button></div>
        </div>
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <h3 class="font-bold text-lg mb-3"><i class="fas fa-fire text-orange-500 mr-2"></i> Mais lidos</h3>
          <div id="popularList">${popularesHtml}</div>
        </div>
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <h3 class="font-bold text-lg mb-3">Tags em alta</h3>
          <div id="tagCloud" class="flex flex-wrap gap-2">${tagsHtml}</div>
        </div>
      </aside>
    </div>
  </main>

  <footer class="bg-gray-900 dark:bg-black/80 text-gray-300 mt-16 pt-12 pb-6">
    <div class="container mx-auto px-5 lg:px-8 text-center text-sm">&copy; 2026 ModoDigital</div>
  </footer>

  <button id="backToTop" class="back-to-top w-10 h-10 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center"><i class="fas fa-arrow-up"></i></button>

  <script>
    // Dados dos posts do servidor
    const postsData = ${JSON.stringify(posts)};
    
    let visibleCount = 6;
    let currentFilter = 'all';
    
    function renderPosts() {
      let filtered = currentFilter === 'all' ? postsData : postsData.filter(p => p.categoria === currentFilter);
      filtered.sort((a,b) => new Date(b.data) - new Date(a.data));
      const toShow = filtered.slice(0, visibleCount);
      const container = document.getElementById('postsContainer');
      if(!container) return;
      container.innerHTML = toShow.map(post => \`
        <div class="post-card bg-white dark:bg-gray-800/70 rounded-2xl overflow-hidden shadow-md hover:shadow-xl">
          <img src="\${post.imagem}" class="w-full h-48 object-cover">
          <div class="p-5">
            <div class="flex justify-between text-xs text-blue-600 mb-2"><span class="bg-blue-600/10 px-2 py-0.5 rounded-full">\${post.categoria}</span><span><i class="far fa-calendar-alt mr-1"></i>\${new Date(post.data).toLocaleDateString('pt-BR')}</span></div>
            <h3 class="text-xl font-bold mb-2"><a href="/post/\${post.slug}" class="hover:text-blue-600">\${post.titulo}</a></h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm mb-3">\${post.resumo}</p>
            <div class="flex justify-between items-center pt-3 border-t"><span class="text-xs"><i class="far fa-user-circle mr-1"></i> \${post.autor}</span><a href="/post/\${post.slug}" class="text-blue-600 text-sm">Leia mais →</a></div>
          </div>
        </div>
      \`).join('');
      const endMsg = document.getElementById('endMessage');
      if(visibleCount >= filtered.length) document.getElementById('loadMoreBtn')?.classList.add('hidden');
      else document.getElementById('loadMoreBtn')?.classList.remove('hidden');
    }
    
    function applyFilter(cat) { currentFilter = cat; visibleCount = 6; renderPosts(); }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.onclick = () => applyFilter(btn.dataset.filter);
    });
    
    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const results = postsData.filter(p => p.titulo.toLowerCase().includes(term) || p.categoria.toLowerCase().includes(term));
      const preview = document.getElementById('searchResultsPreview');
      preview.innerHTML = results.slice(0,5).map(p => \`<div class="p-2 border-b"><a href="/post/\${p.slug}" class="font-medium hover:text-blue-600">\${p.titulo}</a><div class="text-xs text-gray-500">\${p.categoria}</div></div>\`).join('');
    });
    
    // Mobile menu
    const mobileMenu = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('globalOverlay');
    document.getElementById('mobileMenuBtn')?.onclick = () => { mobileMenu.classList.add('open'); overlay.classList.add('opacity-100','visible'); };
    document.getElementById('closeMenuBtn')?.onclick = () => { mobileMenu.classList.remove('open'); overlay.classList.remove('opacity-100','visible'); };
    overlay?.onclick = () => { mobileMenu.classList.remove('open'); overlay.classList.remove('opacity-100','visible'); };
    
    // Search modal
    const searchModal = document.getElementById('searchModal');
    document.getElementById('searchToggleBtn')?.onclick = () => { searchModal.classList.add('active'); overlay.classList.add('opacity-100','visible'); };
    document.getElementById('closeSearchBtn')?.onclick = () => { searchModal.classList.remove('active'); overlay.classList.remove('opacity-100','visible'); };
    
    // Dark mode
    const darkToggle = document.getElementById('darkModeToggle');
    if(localStorage.theme === 'dark') document.documentElement.classList.add('dark');
    darkToggle?.onclick = () => {
      if(document.documentElement.classList.contains('dark')) { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; }
      else { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; }
    };
    
    // Back to top
    const backBtn = document.getElementById('backToTop');
    window.onscroll = () => { if(window.scrollY > 400) backBtn.classList.add('show'); else backBtn.classList.remove('show'); };
    backBtn.onclick = () => window.scrollTo({top:0,behavior:'smooth'});
  </script>
</body>
</html>
  `);
});

// =============================================================
// PÁGINA DO POST
// =============================================================
app.get('/post/:slug', (req, res) => {
  const posts = lerPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  
  if (!post) return res.status(404).send('<h1>Post não encontrado</h1><a href="/">Voltar</a>');
  
  // Incrementar visualizações
  post.visualizacoes = (post.visualizacoes || 0) + 1;
  salvarPosts(posts);
  
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${post.titulo} | ModoDigital</title>
  <meta name="description" content="${post.resumo}">
  <meta property="og:title" content="${post.titulo}">
  <meta property="og:image" content="${post.imagem}">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>.prose-custom p{margin-bottom:1rem;line-height:1.7;} .prose-custom h2{font-size:1.5rem;margin:1.5rem 0 1rem;font-weight:bold;} .prose-custom img{max-width:100%;border-radius:0.5rem;margin:1rem 0;}</style>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <a href="/" class="text-blue-600">← Voltar</a>
    <article class="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 mt-4">
      <h1 class="text-4xl font-bold mb-4">${post.titulo}</h1>
      <div class="flex gap-4 text-sm text-gray-500 mb-6">
        <span>👤 ${post.autor}</span>
        <span>📅 ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
        <span>👁️ ${post.visualizacoes || 0}</span>
      </div>
      <img src="${post.imagem}" class="w-full rounded-xl mb-6">
      <div class="prose-custom">${post.conteudo}</div>
    </article>
  </div>
</body>
</html>
  `);
});

// =============================================================
// CATEGORIA
// =============================================================
app.get('/categoria/:nome', (req, res) => {
  const posts = lerPosts();
  const filtrados = posts.filter(p => p.categoria === req.params.nome);
  
  let html = '<!DOCTYPE html><html><head><title>' + req.params.nome + ' | ModoDigital</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50"><div class="container mx-auto px-4 py-8"><a href="/" class="text-blue-600">← Voltar</a><h1 class="text-3xl font-bold mt-4 mb-6">📁 ' + req.params.nome + '</h1>';
  
  for (const p of filtrados) {
    html += `<div class="bg-white rounded-lg shadow p-4 mb-3"><a href="/post/${p.slug}" class="text-xl font-bold hover:text-blue-600">${p.titulo}</a><p class="text-sm text-gray-500 mt-1">${new Date(p.data).toLocaleDateString('pt-BR')}</p></div>`;
  }
  
  if (filtrados.length === 0) html += '<p>Nenhum artigo nesta categoria.</p>';
  html += '</div></body></html>';
  res.send(html);
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
  <div class="bg-white p-8 rounded-2xl shadow w-96"><h1 class="text-2xl font-bold text-center mb-6">Login Admin</h1>
  <form method="POST" action="/admin/login"><input type="password" name="senha" placeholder="Senha" class="w-full p-3 border rounded-xl mb-4"><button class="w-full bg-blue-600 text-white p-3 rounded-xl">Entrar</button></form></div>
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

app.get('/admin/dashboard', (req, res) => {
  if (!adminLogado) return res.redirect('/admin');
  const posts = lerPosts();
  let lista = '';
  for (const p of posts) {
    lista += `<div class="border p-3 rounded mb-2 flex justify-between items-center"><div><strong>${p.titulo}</strong><br><small>${p.categoria} | ${p.autor}</small></div><a href="/post/${p.slug}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ver</a></div>`;
  }
  res.send(`
<!DOCTYPE html>
<html>
<head><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8">
    <div class="bg-white rounded-2xl shadow p-6">
      <h1 class="text-2xl font-bold mb-4">Painel Admin</h1>
      <p class="mb-4">Total: <strong>${posts.length}</strong> artigos</p>
      <div class="flex gap-3 mb-6"><a href="/admin/novo" class="bg-green-600 text-white px-4 py-2 rounded">➕ Novo Artigo</a><a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a></div>
      <h2 class="font-bold mb-2">Artigos:</h2>
      ${lista || '<p>Nenhum artigo</p>'}
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
        <input type="text" name="imagem" placeholder="URL da imagem" class="w-full p-3 border rounded-xl mb-3">
        <textarea name="resumo" rows="2" placeholder="Resumo curto" class="w-full p-3 border rounded-xl mb-3" required></textarea>
        <textarea name="conteudo" rows="10" placeholder="Conteúdo do artigo (HTML permitido)" class="w-full p-3 border rounded-xl mb-3" required></textarea>
        <div class="flex gap-3"><button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-xl">Publicar</button><a href="/admin/dashboard" class="bg-gray-500 text-white px-6 py-2 rounded-xl">Cancelar</a></div>
      </form>
    </div>
  </div>
</body>
</html>
  `);
});

app.post('/admin/novo', (req, res) => {
  if (!adminLogado) return res.redirect('/admin');
  
  const posts = lerPosts();
  const novoPost = {
    slug: criarSlug(req.body.titulo),
    titulo: req.body.titulo,
    categoria: req.body.categoria,
    autor: req.body.autor,
    imagem: req.body.imagem || 'https://picsum.photos/id/1/800/400',
    resumo: req.body.resumo,
    conteudo: req.body.conteudo,
    data: new Date().toISOString(),
    visualizacoes: 0
  };
  
  posts.push(novoPost);
  salvarPosts(posts);
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
