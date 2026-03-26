const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const POSTS_FILE = path.join(__dirname, 'posts.json');

if (!fs.existsSync(POSTS_FILE)) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify([], null, 2));
}

function lerPosts() {
  return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
}

function salvarPosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// =============================================================
// PÁGINA INICIAL
// =============================================================
app.get('/', (req, res) => {
  const posts = lerPosts();
  posts.sort((a, b) => new Date(b.data) - new Date(a.data));
  
  const featured = posts.slice(0, 3);
  const outros = posts.slice(3);
  const categorias = [...new Set(posts.map(p => p.categoria))];
  
  let featuredHtml = '';
  for (const post of featured) {
    featuredHtml += `
      <div class="group relative rounded-xl overflow-hidden shadow-lg h-64 md:h-72">
        <img src="${post.imagem}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${post.titulo}">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
        <div class="absolute bottom-0 left-0 p-5 text-white">
          <span class="bg-primary text-xs px-2 py-1 rounded-full">${post.categoria}</span>
          <h3 class="text-xl font-bold mt-2 line-clamp-2">${post.titulo}</h3>
          <p class="text-sm opacity-90 mt-1">${new Date(post.data).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    `;
  }
  
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
            <a href="/${post.slug}">${post.titulo}</a>
          </h3>
          <p class="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 mb-3">${post.resumo}</p>
          <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
            <span class="text-xs text-gray-400"><i class="far fa-user-circle mr-1"></i> ${post.autor}</span>
            <a href="/${post.slug}" class="text-primary text-sm font-medium hover:underline">Leia mais <i class="fas fa-arrow-right text-xs"></i></a>
          </div>
        </div>
      </div>
    `;
  }
  
  const populares = [...posts].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 4);
  let popularesHtml = '';
  for (const post of populares) {
    popularesHtml += `
      <div class="flex gap-3 items-center">
        <img src="${post.imagem}" class="w-14 h-14 rounded-lg object-cover" alt="">
        <div>
          <a href="/${post.slug}" class="font-medium hover:text-primary text-sm">${post.titulo.length > 45 ? post.titulo.slice(0,42)+'...' : post.titulo}</a>
          <div class="text-xs text-gray-400">${new Date(post.data).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>
    `;
  }
  
  let tagsHtml = '';
  for (const cat of categorias) {
    tagsHtml += `<button data-filter="${cat}" class="filter-tag px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs hover:bg-primary/30 transition">#${cat}</button>`;
  }
  
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>ModoDigital | Blog de Tecnologia & Marketing Digital</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { 'sans': ['Inter', 'system-ui', 'sans-serif'], 'display': ['Montserrat', 'Inter', 'sans-serif'] },
          colors: { primary: '#3b82f6', darkbg: '#0f172a' },
          animation: { 'fade-in': 'fadeIn 0.5s ease-out', 'slide-up': 'slideUp 0.4s ease' },
          keyframes: { fadeIn: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }, slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    body { transition: background-color 0.25s ease, color 0.2s ease; }
    .mobile-menu { transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1); transform: translateX(-100%); }
    .mobile-menu.open { transform: translateX(0); }
    .search-modal { transition: opacity 0.2s ease, visibility 0.2s, transform 0.2s ease; opacity: 0; visibility: hidden; transform: scale(0.96); }
    .search-modal.active { opacity: 1; visibility: visible; transform: scale(1); }
    .overlay { transition: opacity 0.25s ease, visibility 0.25s; }
    .sticky-header { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); box-shadow: 0 4px 20px rgba(0,0,0,0.05); transition: all 0.2s; }
    .dark .sticky-header { background: rgba(15,23,42,0.92); backdrop-filter: blur(12px); }
    .back-to-top { transition: all 0.2s; opacity: 0; visibility: hidden; bottom: 20px; right: 20px; position: fixed; z-index: 40; }
    .back-to-top.show { opacity: 1; visibility: visible; }
    .post-card { transition: transform 0.25s ease, box-shadow 0.3s; }
    .post-card:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -12px rgba(0,0,0,0.1); }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; }
    .dark ::-webkit-scrollbar-track { background: #1e293b; }
    ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 8px; }
    .article-content { line-height: 1.8; }
    .article-content p { margin-bottom: 1rem; }
    .article-content h2 { font-size: 1.5rem; margin: 1.5rem 0 1rem; font-weight: bold; }
    .article-content h3 { font-size: 1.25rem; margin: 1.2rem 0 0.8rem; font-weight: bold; }
    .article-content img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    .article-content ul, .article-content ol { margin: 1rem 0 1rem 2rem; }
    .article-content blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 1rem 0; color: #4b5563; font-style: italic; }
    .share-btn { transition: all 0.2s; }
    .share-btn:hover { transform: translateY(-2px); }
  </style>
</head>
<body class="bg-gray-50 dark:bg-darkbg text-gray-800 dark:text-gray-200 font-sans antialiased transition-colors duration-300">

  <div id="globalOverlay" class="overlay fixed inset-0 bg-black/50 dark:bg-black/70 z-40 opacity-0 invisible"></div>

  <header id="mainHeader" class="bg-white dark:bg-darkbg/95 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-sm">
    <div class="container mx-auto px-5 lg:px-8 flex items-center justify-between h-16 md:h-20">
      <div class="flex items-center gap-2">
        <a href="/" class="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Modo<span class="text-gray-800 dark:text-white">Digital</span></a>
        <span class="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full hidden sm:inline-block">beta</span>
      </div>
      <nav class="hidden lg:flex items-center space-x-8 text-sm font-medium">
        <a href="/" class="hover:text-primary transition">Início</a>
        ${categorias.map(c => `<a href="/categoria/${c}" class="hover:text-primary transition">${c}</a>`).join('')}
      </nav>
      <div class="flex items-center gap-3">
        <button id="searchToggleBtn" class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition"><i class="fas fa-search text-sm"></i></button>
        <button id="darkModeToggle" class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><i class="fas fa-moon dark:hidden"></i><i class="fas fa-sun hidden dark:inline-block text-yellow-400"></i></button>
        <button id="mobileMenuBtn" class="lg:hidden w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800"><i class="fas fa-bars"></i></button>
      </div>
    </div>
  </header>

  <div id="mobileDrawer" class="mobile-menu fixed top-0 left-0 w-[280px] h-full bg-white dark:bg-darkbg z-50 shadow-2xl flex flex-col p-6 gap-6">
    <div class="flex justify-between border-b pb-3"><span class="font-bold text-xl">Menu</span><button id="closeMenuBtn"><i class="fas fa-times text-xl"></i></button></div>
    <nav class="flex flex-col gap-4">
      <a href="/" class="hover:text-primary py-1">Início</a>
      ${categorias.map(c => `<a href="/categoria/${c}" class="hover:text-primary py-1">${c}</a>`).join('')}
    </nav>
    <div class="mt-auto pt-6 border-t">
      <div class="flex gap-4 justify-center text-gray-500">
        <i class="fab fa-facebook-f hover:text-primary cursor-pointer"></i>
        <i class="fab fa-twitter hover:text-primary cursor-pointer"></i>
        <i class="fab fa-instagram hover:text-primary cursor-pointer"></i>
        <i class="fab fa-youtube hover:text-primary cursor-pointer"></i>
      </div>
      <p class="text-xs text-center mt-4 text-gray-400">© 2026 ModoDigital</p>
    </div>
  </div>

  <div id="searchModal" class="search-modal fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-xl bg-white dark:bg-darkbg rounded-2xl shadow-2xl z-50 p-5">
    <div class="flex justify-between border-b pb-2 mb-4"><h3 class="text-xl font-semibold">Buscar artigos</h3><button id="closeSearchBtn"><i class="fas fa-times text-xl"></i></button></div>
    <input type="text" id="searchInput" placeholder="Digite título, categoria..." class="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary">
    <div id="searchResultsPreview" class="mt-5 max-h-96 overflow-y-auto space-y-3 text-sm"></div>
  </div>

  <main class="container mx-auto px-5 lg:px-8 py-8 md:py-12">
    <div class="mb-12">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-2xl md:text-3xl font-bold font-display border-l-4 border-primary pl-3">Destaques da Semana</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6" id="featuredGrid">${featuredHtml || '<p class="col-span-3 text-center">Nenhum post em destaque</p>'}</div>
    </div>

    <div class="flex flex-col lg:flex-row gap-10">
      <div class="lg:w-2/3 w-full">
        <div class="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h2 class="text-2xl font-bold font-display">Últimos Artigos</h2>
          <div class="flex gap-2 text-sm">
            <button data-filter="all" class="filter-btn px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">Todos</button>
            ${categorias.map(c => `<button data-filter="${c}" class="filter-btn px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-primary/20">${c}</button>`).join('')}
          </div>
        </div>
        <div id="postsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-6">${postsHtml || '<p class="col-span-2 text-center">Nenhum artigo ainda</p>'}</div>
        <div class="flex justify-center mt-10"><button id="loadMoreBtn" class="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-full shadow-md flex items-center gap-2"><i class="fas fa-redo-alt"></i> Carregar mais</button></div>
        <div id="endMessage" class="text-center text-gray-400 mt-6 text-sm hidden">✨ Todos os artigos carregados ✨</div>
      </div>

      <aside class="lg:w-1/3 w-full space-y-8">
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <div class="flex items-center gap-2 text-primary text-xl mb-2"><i class="fas fa-envelope-open-text"></i><h3 class="font-bold text-lg">Newsletter</h3></div>
          <p class="text-sm mb-4">Receba as novidades em primeira mão.</p>
          <div class="flex gap-2"><input type="email" placeholder="seu@email.com" class="flex-1 p-2 border rounded-xl dark:bg-gray-700"><button class="bg-primary text-white px-4 rounded-xl">Assinar</button></div>
        </div>
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <h3 class="font-bold text-lg mb-3"><i class="fas fa-fire text-orange-500 mr-2"></i> Mais lidos</h3>
          <div id="popularList" class="space-y-4">${popularesHtml}</div>
        </div>
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <h3 class="font-bold text-lg mb-3">Tags em alta</h3>
          <div id="tagCloud" class="flex flex-wrap gap-2">${tagsHtml}</div>
        </div>
      </aside>
    </div>
  </main>

  <footer class="bg-gray-900 dark:bg-black/80 text-gray-300 mt-16 pt-12 pb-6 border-t border-gray-800">
    <div class="container mx-auto px-5 lg:px-8 text-center text-sm">&copy; 2026 ModoDigital — Criado com <i class="fas fa-heart text-red-500"></i> por Vailink.pro</div>
  </footer>

  <button id="backToTop" class="back-to-top w-10 h-10 bg-primary text-white rounded-full shadow-lg flex items-center justify-center"><i class="fas fa-arrow-up"></i></button>

  <script>
    const postsFromServer = ${JSON.stringify(posts)};
    let visibleCount = 6, currentFilter = 'all';
    
    function renderPosts() {
      let filtered = currentFilter === 'all' ? [...postsFromServer] : postsFromServer.filter(p => p.categoria === currentFilter);
      filtered.sort((a,b) => new Date(b.data) - new Date(a.data));
      const toShow = filtered.slice(0, visibleCount);
      document.getElementById('postsContainer').innerHTML = toShow.map(p => \`
        <div class="post-card bg-white dark:bg-gray-800/70 rounded-2xl overflow-hidden shadow-md hover:shadow-xl">
          <img src="\${p.imagem}" class="w-full h-48 object-cover">
          <div class="p-5">
            <div class="flex justify-between text-xs text-primary mb-2"><span class="bg-primary/10 px-2 py-0.5 rounded-full">\${p.categoria}</span><span><i class="far fa-calendar-alt mr-1"></i>\${new Date(p.data).toLocaleDateString('pt-BR')}</span></div>
            <h3 class="text-xl font-bold mb-2"><a href="/\${p.slug}" class="hover:text-primary">\${p.titulo}</a></h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm mb-3">\${p.resumo}</p>
            <div class="flex justify-between items-center pt-3 border-t"><span class="text-xs"><i class="far fa-user-circle mr-1"></i> \${p.autor}</span><a href="/\${p.slug}" class="text-primary text-sm">Leia mais →</a></div>
          </div>
        </div>
      \`).join('');
      const endMsg = document.getElementById('endMessage');
      if(visibleCount >= filtered.length) { document.getElementById('loadMoreBtn').classList.add('hidden'); endMsg.classList.remove('hidden'); }
      else { document.getElementById('loadMoreBtn').classList.remove('hidden'); endMsg.classList.add('hidden'); }
    }
    
    function applyFilter(cat) { currentFilter = cat; visibleCount = 6; renderPosts(); }
    document.querySelectorAll('.filter-btn').forEach(btn => btn.onclick = () => applyFilter(btn.dataset.filter));
    document.querySelectorAll('.filter-tag').forEach(btn => btn.onclick = () => applyFilter(btn.dataset.filter));
    document.getElementById('loadMoreBtn').onclick = () => { visibleCount += 4; renderPosts(); };
    
    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.oninput = () => {
      const term = searchInput.value.toLowerCase();
      const results = postsFromServer.filter(p => p.titulo.toLowerCase().includes(term) || p.categoria.toLowerCase().includes(term));
      document.getElementById('searchResultsPreview').innerHTML = results.slice(0,5).map(p => \`<div class="p-2 border-b"><a href="/\${p.slug}" class="font-medium hover:text-primary">\${p.titulo}</a><div class="text-xs text-gray-500">\${p.categoria}</div></div>\`).join('');
    };
    
    // Mobile menu
    const mobileMenu = document.getElementById('mobileDrawer'), overlay = document.getElementById('globalOverlay');
    document.getElementById('mobileMenuBtn').onclick = () => { mobileMenu.classList.add('open'); overlay.classList.add('opacity-100','visible'); };
    document.getElementById('closeMenuBtn').onclick = () => { mobileMenu.classList.remove('open'); overlay.classList.remove('opacity-100','visible'); };
    overlay.onclick = () => { mobileMenu.classList.remove('open'); overlay.classList.remove('opacity-100','visible'); };
    
    // Search modal
    const searchModal = document.getElementById('searchModal');
    document.getElementById('searchToggleBtn').onclick = () => { searchModal.classList.add('active'); overlay.classList.add('opacity-100','visible'); };
    document.getElementById('closeSearchBtn').onclick = () => { searchModal.classList.remove('active'); overlay.classList.remove('opacity-100','visible'); };
    
    // Dark mode
    const darkToggle = document.getElementById('darkModeToggle');
    if(localStorage.theme === 'dark') document.documentElement.classList.add('dark');
    darkToggle.onclick = () => {
      if(document.documentElement.classList.contains('dark')) { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; }
      else { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; }
    };
    
    // Back to top
    const backBtn = document.getElementById('backToTop');
    window.onscroll = () => { if(window.scrollY > 400) backBtn.classList.add('show'); else backBtn.classList.remove('show'); };
    backBtn.onclick = () => window.scrollTo({top:0,behavior:'smooth'});
    
    renderPosts();
  </script>
</body>
</html>`);
});

// =============================================================
// PÁGINA DO ARTIGO - COM COMPARTILHAMENTO
// =============================================================
app.get('/:slug', (req, res) => {
  const posts = lerPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  
  if (!post) {
    return res.status(404).send('<h1>Artigo não encontrado</h1><a href="/">Voltar</a>');
  }
  
  post.visualizacoes = (post.visualizacoes || 0) + 1;
  salvarPosts(posts);
  
  const urlAtual = `https://${req.get('host')}${req.originalUrl}`;
  const tituloCodificado = encodeURIComponent(post.titulo);
  const urlCodificada = encodeURIComponent(urlAtual);
  
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.titulo} | ModoDigital</title>
  <meta name="description" content="${post.resumo}">
  <meta property="og:title" content="${post.titulo}">
  <meta property="og:description" content="${post.resumo}">
  <meta property="og:image" content="${post.imagem}">
  <meta property="og:url" content="${urlAtual}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${post.titulo}">
  <meta name="twitter:description" content="${post.resumo}">
  <meta name="twitter:image" content="${post.imagem}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    body { font-family: 'Inter', sans-serif; background: #f9fafb; }
    .dark body { background: #0f172a; }
    .article-content { line-height: 1.8; }
    .article-content p { margin-bottom: 1rem; }
    .article-content h2 { font-size: 1.5rem; margin: 1.5rem 0 1rem; font-weight: bold; }
    .article-content h3 { font-size: 1.25rem; margin: 1.2rem 0 0.8rem; font-weight: bold; }
    .article-content img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    .article-content ul, .article-content ol { margin: 1rem 0 1rem 2rem; }
    .article-content blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 1rem 0; color: #4b5563; font-style: italic; }
    .share-btn { transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 40px; font-weight: 500; }
    .share-btn:hover { transform: translateY(-2px); }
  </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <a href="/" class="text-blue-600 hover:underline inline-flex items-center gap-1 mb-6"><i class="fas fa-arrow-left text-sm"></i> Voltar</a>
    
    <article class="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 md:p-8">
      <h1 class="text-3xl md:text-4xl font-bold mb-4">${post.titulo}</h1>
      <div class="flex flex-wrap gap-4 text-sm text-gray-500 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <span><i class="far fa-user-circle mr-1"></i> ${post.autor}</span>
        <span><i class="far fa-calendar-alt mr-1"></i> ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
        <span><i class="far fa-eye mr-1"></i> ${post.visualizacoes} visualizações</span>
        <span><i class="fas fa-tag mr-1"></i> ${post.categoria}</span>
      </div>
      
      <img src="${post.imagem}" class="w-full rounded-xl mb-8" alt="${post.titulo}">
      
      <div class="article-content">${post.conteudo}</div>
      
      <!-- Botões de Compartilhamento -->
      <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2"><i class="fas fa-share-alt text-primary"></i> Compartilhe este artigo</h3>
        <div class="flex flex-wrap gap-3">
          <a href="https://www.facebook.com/sharer/sharer.php?u=${urlCodificada}" target="_blank" class="share-btn bg-[#1877f2] text-white hover:bg-[#0c63d4]"><i class="fab fa-facebook-f"></i> Facebook</a>
          <a href="https://twitter.com/intent/tweet?text=${tituloCodificado}&url=${urlCodificada}" target="_blank" class="share-btn bg-[#1da1f2] text-white hover:bg-[#0c8de0]"><i class="fab fa-twitter"></i> Twitter</a>
          <a href="https://wa.me/?text=${tituloCodificado}%20-%20${urlCodificada}" target="_blank" class="share-btn bg-[#25d366] text-white hover:bg-[#20b859]"><i class="fab fa-whatsapp"></i> WhatsApp</a>
          <a href="https://www.linkedin.com/shareArticle?mini=true&url=${urlCodificada}&title=${tituloCodificado}" target="_blank" class="share-btn bg-[#0a66c2] text-white hover:bg-[#084e96]"><i class="fab fa-linkedin-in"></i> LinkedIn</a>
          <a href="mailto:?subject=${tituloCodificado}&body=Confira este artigo: ${urlCodificada}" class="share-btn bg-gray-600 text-white hover:bg-gray-700"><i class="fas fa-envelope"></i> Email</a>
        </div>
      </div>
      
      <!-- Barra de compartilhamento flutuante para mobile -->
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full shadow-lg p-2 flex gap-2 md:hidden z-50">
        <a href="https://wa.me/?text=${tituloCodificado}%20-%20${urlCodificada}" target="_blank" class="w-10 h-10 rounded-full bg-[#25d366] text-white flex items-center justify-center"><i class="fab fa-whatsapp"></i></a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${urlCodificada}" target="_blank" class="w-10 h-10 rounded-full bg-[#1877f2] text-white flex items-center justify-center"><i class="fab fa-facebook-f"></i></a>
        <a href="https://twitter.com/intent/tweet?text=${tituloCodificado}&url=${urlCodificada}" target="_blank" class="w-10 h-10 rounded-full bg-[#1da1f2] text-white flex items-center justify-center"><i class="fab fa-twitter"></i></a>
        <button onclick="navigator.clipboard.writeText('${urlAtual}'); alert('Link copiado!')" class="w-10 h-10 rounded-full bg-gray-500 text-white flex items-center justify-center"><i class="fas fa-link"></i></button>
      </div>
    </article>
    
    <div class="mt-8 text-center">
      <a href="/" class="text-blue-600 hover:underline">← Voltar para o início</a>
    </div>
  </div>
  
  <script>
    // Dark mode toggle
    if(localStorage.theme === 'dark') document.documentElement.classList.add('dark');
    const darkToggle = document.createElement('button');
    darkToggle.innerHTML = '<i class="fas fa-moon"></i>';
    darkToggle.className = 'fixed bottom-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg z-50 md:hidden';
    darkToggle.onclick = () => {
      if(document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
      } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
      }
    };
    document.body.appendChild(darkToggle);
  </script>
</body>
</html>`);
});

// =============================================================
// CATEGORIA
// =============================================================
app.get('/categoria/:nome', (req, res) => {
  const posts = lerPosts();
  const filtrados = posts.filter(p => p.categoria === req.params.nome);
  
  let html = `<!DOCTYPE html><html><head><title>${req.params.nome} | ModoDigital</title><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"></head><body class="bg-gray-50 dark:bg-gray-900"><div class="container mx-auto px-4 py-8"><a href="/" class="text-blue-600 hover:underline inline-flex items-center gap-1"><i class="fas fa-arrow-left text-sm"></i> Voltar</a><h1 class="text-3xl font-bold mt-4 mb-6">📁 ${req.params.nome}</h1>`;
  
  for (const p of filtrados) {
    html += `<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-3 hover:shadow-md transition"><a href="/${p.slug}" class="text-xl font-bold hover:text-blue-600">${p.titulo}</a><p class="text-sm text-gray-500 mt-1"><i class="far fa-calendar-alt mr-1"></i> ${new Date(p.data).toLocaleDateString('pt-BR')}</p></div>`;
  }
  
  if (filtrados.length === 0) html += '<p class="text-gray-500 text-center py-8">Nenhum artigo nesta categoria.</p>';
  html += `</div><script>if(localStorage.theme === 'dark') document.documentElement.classList.add('dark');</script></body></html>`;
  res.send(html);
});

// =============================================================
// INICIAR
// =============================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(3000, () => console.log('🚀 http://localhost:3000'));
}