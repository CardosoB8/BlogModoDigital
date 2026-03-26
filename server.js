const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivo de posts
const POSTS_FILE = path.join(__dirname, 'posts.json');

// Inicializar posts.json
if (!fs.existsSync(POSTS_FILE)) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify([], null, 2));
}

// Funções para manipular posts
function lerPosts() {
  return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
}

function salvarPosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

function criarSlug(titulo) {
  return titulo.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// =============================================================
// PÁGINA INICIAL - HTML COMPLETO COM DESIGN ORIGINAL
// =============================================================
app.get('/', (req, res) => {
  const posts = lerPosts();
  
  // Ordenar por data (mais recentes primeiro)
  posts.sort((a, b) => new Date(b.data) - new Date(a.data));
  
  const featured = posts.slice(0, 3);
  const outros = posts.slice(3);
  
  // Gerar HTML dos posts em destaque
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
  
  // Gerar HTML dos posts populares
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
  
  // HTML COMPLETO COM O DESIGN ORIGINAL
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
          fontFamily: {
            'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
            'display': ['Montserrat', 'Inter', 'sans-serif']
          },
          colors: {
            primary: '#3b82f6',
            darkbg: '#0f172a',
            cardbg: '#ffffff',
            darkcard: '#1e293b'
          },
          animation: {
            'fade-in': 'fadeIn 0.5s ease-out',
            'slide-up': 'slideUp 0.4s ease',
            'spin-slow': 'spin 3s linear infinite',
          },
          keyframes: {
            fadeIn: {
              '0%': { opacity: '0', transform: 'translateY(8px)' },
              '100%': { opacity: '1', transform: 'translateY(0)' }
            },
            slideUp: {
              '0%': { opacity: '0', transform: 'translateY(20px)' },
              '100%': { opacity: '1', transform: 'translateY(0)' }
            }
          }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=Montserrat:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    body { transition: background-color 0.25s ease, color 0.2s ease; }
    .mobile-menu { transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1); transform: translateX(-100%); }
    .mobile-menu.open { transform: translateX(0); }
    .search-modal { transition: opacity 0.2s ease, visibility 0.2s, transform 0.2s ease; opacity: 0; visibility: hidden; transform: scale(0.96); }
    .search-modal.active { opacity: 1; visibility: visible; transform: scale(1); }
    .overlay { transition: opacity 0.25s ease, visibility 0.25s; }
    .sticky-header { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(12px); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); transition: all 0.2s; }
    .dark .sticky-header { background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(12px); }
    .back-to-top { transition: all 0.2s; opacity: 0; visibility: hidden; bottom: 20px; right: 20px; position: fixed; z-index: 40; }
    .back-to-top.show { opacity: 1; visibility: visible; }
    .post-card { transition: transform 0.25s ease, box-shadow 0.3s; }
    .post-card:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -12px rgba(0, 0, 0, 0.1); }
    .dark .post-card { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; }
    .dark ::-webkit-scrollbar-track { background: #1e293b; }
    ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 8px; }
    .prose-custom p { margin-bottom: 1rem; line-height: 1.6; }
  </style>
</head>
<body class="bg-gray-50 dark:bg-darkbg text-gray-800 dark:text-gray-200 font-sans antialiased transition-colors duration-300">

  <div id="globalOverlay" class="overlay fixed inset-0 bg-black/50 dark:bg-black/70 z-40 opacity-0 invisible transition-all duration-300"></div>

  <header id="mainHeader" class="bg-white dark:bg-darkbg/95 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-sm transition-all">
    <div class="container mx-auto px-5 lg:px-8 flex items-center justify-between h-16 md:h-20">
      <div class="flex items-center gap-2">
        <a href="/" class="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Modo<span class="text-gray-800 dark:text-white">Digital</span></a>
        <span class="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full hidden sm:inline-block">beta</span>
      </div>
      <nav class="hidden lg:flex items-center space-x-8 text-sm font-medium">
        <a href="/" class="hover:text-primary transition">Início</a>
        ${categorias.map(c => `<a href="/categoria/${c}" class="hover:text-primary transition">${c}</a>`).join('')}
      </nav>
      <div class="flex items-center gap-3">
        <button id="searchToggleBtn" aria-label="Buscar" class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition">
          <i class="fas fa-search text-sm"></i>
        </button>
        <button id="darkModeToggle" aria-label="Dark mode" class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-primary/10 transition">
          <i class="fas fa-moon dark:hidden"></i>
          <i class="fas fa-sun hidden dark:inline-block text-yellow-400"></i>
        </button>
        <button id="mobileMenuBtn" class="lg:hidden w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <i class="fas fa-bars text-gray-700 dark:text-gray-300 text-lg"></i>
        </button>
      </div>
    </div>
  </header>

  <div id="mobileDrawer" class="mobile-menu fixed top-0 left-0 w-[280px] h-full bg-white dark:bg-darkbg z-50 shadow-2xl flex flex-col p-6 gap-6 transition-transform duration-300">
    <div class="flex justify-between items-center border-b pb-3 border-gray-200 dark:border-gray-700">
      <span class="font-bold text-xl">Menu</span>
      <button id="closeMenuBtn" class="text-gray-500 hover:text-primary text-xl"><i class="fas fa-times"></i></button>
    </div>
    <nav class="flex flex-col gap-4 text-base font-medium">
      <a href="/" class="hover:text-primary transition py-1">Início</a>
      ${categorias.map(c => `<a href="/categoria/${c}" class="hover:text-primary transition py-1">${c}</a>`).join('')}
      <a href="/admin" class="mt-2 bg-primary/10 text-primary px-4 py-2 rounded-lg text-center">Admin</a>
    </nav>
    <div class="mt-auto pt-6 border-t border-gray-200 dark:border-gray-700">
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
    <div class="flex justify-between items-center border-b pb-2 mb-4 border-gray-200 dark:border-gray-700">
      <h3 class="text-xl font-semibold">Buscar artigos</h3>
      <button id="closeSearchBtn" class="text-gray-500 hover:text-primary"><i class="fas fa-times text-xl"></i></button>
    </div>
    <input type="text" id="searchInput" placeholder="Digite título, categoria..." class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary">
    <div id="searchResultsPreview" class="mt-5 max-h-96 overflow-y-auto space-y-3 text-sm"></div>
    <div class="text-xs text-gray-400 mt-3 text-center">Resultados em tempo real</div>
  </div>

  <main class="container mx-auto px-5 lg:px-8 py-8 md:py-12">
    <div class="mb-12">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-2xl md:text-3xl font-bold font-display border-l-4 border-primary pl-3">Destaques da Semana</h2>
        <a href="#" class="text-primary text-sm font-medium hover:underline">Ver todos <i class="fas fa-arrow-right ml-1 text-xs"></i></a>
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
        <div id="postsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">${postsHtml || '<p class="col-span-2 text-center">Nenhum artigo publicado ainda. <a href="/admin" class="text-primary">Crie o primeiro!</a></p>'}</div>
        <div class="flex justify-center mt-10">
          <button id="loadMoreBtn" class="bg-primary hover:bg-primary/90 text-white font-medium px-6 py-3 rounded-full shadow-md transition flex items-center gap-2"><i class="fas fa-redo-alt"></i> Carregar mais artigos</button>
        </div>
        <div id="endMessage" class="text-center text-gray-400 mt-6 text-sm hidden">✨ Todos os artigos carregados ✨</div>
      </div>

      <aside class="lg:w-1/3 w-full space-y-8">
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-2 text-primary text-xl mb-2"><i class="fas fa-envelope-open-text"></i><h3 class="font-bold text-lg">Newsletter</h3></div>
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">Receba as novidades em primeira mão + dicas exclusivas.</p>
          <div class="flex gap-2">
            <input type="email" placeholder="seu@email.com" class="flex-1 p-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 text-sm">
            <button class="bg-primary text-white px-4 rounded-xl text-sm font-medium hover:bg-primary/90">Assinar</button>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <h3 class="font-bold text-lg mb-3 flex items-center gap-2"><i class="fab fa-telegram text-primary"></i> Redes</h3>
          <div class="flex flex-wrap gap-3">
            <a href="#" class="w-10 h-10 rounded-full bg-blue-600/10 text-blue-600 flex items-center justify-center text-xl hover:scale-110 transition"><i class="fab fa-facebook-f"></i></a>
            <a href="#" class="w-10 h-10 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center text-xl"><i class="fab fa-twitter"></i></a>
            <a href="#" class="w-10 h-10 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center text-xl"><i class="fab fa-instagram"></i></a>
            <a href="#" class="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center text-xl"><i class="fab fa-whatsapp"></i></a>
            <a href="#" class="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-xl"><i class="fab fa-youtube"></i></a>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <h3 class="font-bold text-lg mb-3 flex items-center gap-2"><i class="fas fa-fire text-orange-500"></i> Mais lidos</h3>
          <div id="popularList" class="space-y-4">${popularesHtml}</div>
        </div>
        <div class="bg-white dark:bg-gray-800/80 rounded-2xl shadow-md p-5">
          <h3 class="font-bold text-lg mb-3">Tags em alta</h3>
          <div id="tagCloud" class="flex flex-wrap gap-2">${tagsHtml}</div>
        </div>
        <div class="bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl p-6 text-center">
          <p class="text-sm font-medium">PUBLICIDADE</p>
          <div class="h-24 flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs">Espaço para anúncio</div>
        </div>
      </aside>
    </div>
  </main>

  <footer class="bg-gray-900 dark:bg-black/80 text-gray-300 mt-16 pt-12 pb-6 border-t border-gray-800">
    <div class="container mx-auto px-5 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 class="text-white text-2xl font-bold mb-2">Modo<span class="text-primary">Digital</span></h3>
          <p class="text-sm text-gray-400">Conteúdo inteligente para acelerar sua vida digital. Tutoriais, marketing e produtividade.</p>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-3">Links rápidos</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-primary transition">Sobre nós</a></li>
            <li><a href="#" class="hover:text-primary transition">Política de privacidade</a></li>
            <li><a href="#" class="hover:text-primary transition">Termos de uso</a></li>
            <li><a href="#" class="hover:text-primary transition">Contato</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-3">Parceiros</h4>
          <p class="text-sm">Vailink.pro • HubSpot • Google News</p>
          <div class="flex gap-3 mt-4 text-xl">
            <i class="fab fa-github hover:text-primary cursor-pointer"></i>
            <i class="fab fa-linkedin hover:text-primary cursor-pointer"></i>
            <i class="fab fa-discord hover:text-primary cursor-pointer"></i>
          </div>
        </div>
      </div>
      <div class="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
        &copy; 2026 ModoDigital — Criado com <i class="fas fa-heart text-red-500"></i> por Vailink.pro & inspiração em templates modernos.
      </div>
    </div>
  </footer>

  <button id="backToTop" class="back-to-top fixed w-10 h-10 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-primary/80 transition-all"><i class="fas fa-arrow-up"></i></button>

  <script>
    const postsFromServer = ${JSON.stringify(posts)};
    
    let visiblePostsCount = 6;
    let currentFilter = "all";
    let filteredPosts = [...postsFromServer];
    
    function renderPosts() {
      const container = document.getElementById('postsContainer');
      if(currentFilter !== 'all') {
        filteredPosts = postsFromServer.filter(p => p.categoria === currentFilter);
      } else {
        filteredPosts = [...postsFromServer];
      }
      filteredPosts.sort((a,b) => new Date(b.data) - new Date(a.data));
      const postsToShow = filteredPosts.slice(0, visiblePostsCount);
      
      container.innerHTML = postsToShow.map(post => \`
        <div class="post-card bg-white dark:bg-gray-800/70 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all flex flex-col h-full">
          <img src="\${post.imagem}" loading="lazy" class="w-full h-48 object-cover" alt="\${post.titulo}">
          <div class="p-5 flex flex-col flex-grow">
            <div class="flex justify-between items-center text-xs text-primary mb-2">
              <span class="bg-primary/10 px-2 py-0.5 rounded-full">\${post.categoria}</span>
              <span class="text-gray-400"><i class="far fa-calendar-alt mr-1"></i>\${new Date(post.data).toLocaleDateString('pt-BR')}</span>
            </div>
            <h3 class="text-xl font-bold mb-2 hover:text-primary transition">
              <a href="/post/\${post.slug}">\${post.titulo}</a>
            </h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 mb-3">\${post.resumo}</p>
            <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
              <span class="text-xs text-gray-400"><i class="far fa-user-circle mr-1"></i> \${post.autor}</span>
              <a href="/post/\${post.slug}" class="text-primary text-sm font-medium hover:underline">Leia mais <i class="fas fa-arrow-right text-xs"></i></a>
            </div>
          </div>
        </div>
      \`).join('');
      
      const endMsg = document.getElementById('endMessage');
      if(visiblePostsCount >= filteredPosts.length) {
        document.getElementById('loadMoreBtn')?.classList.add('hidden');
        if(endMsg) endMsg.classList.remove('hidden');
      } else {
        document.getElementById('loadMoreBtn')?.classList.remove('hidden');
        if(endMsg) endMsg.classList.add('hidden');
      }
    }
    
    function applyFilter(category) {
      currentFilter = category;
      visiblePostsCount = 6;
      renderPosts();
      document.querySelectorAll('.filter-btn').forEach(btn => {
        if(btn.dataset.filter === category) {
          btn.classList.add('bg-primary/10', 'text-primary', 'font-medium');
          btn.classList.remove('bg-gray-200', 'dark:bg-gray-700');
        } else {
          btn.classList.remove('bg-primary/10', 'text-primary', 'font-medium');
          btn.classList.add('bg-gray-200', 'dark:bg-gray-700');
        }
      });
    }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
    });
    
    document.querySelectorAll('.filter-tag').forEach(btn => {
      btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
    });
    
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
      visiblePostsCount += 4;
      renderPosts();
    });
    
    const searchInput = document.getElementById('searchInput');
    const searchResPreview = document.getElementById('searchResultsPreview');
    function updateSearch() {
      const term = searchInput.value.toLowerCase().trim();
      if(!term) { searchResPreview.innerHTML = '<div class="text-gray-400 text-center p-3">Digite para buscar artigos...</div>'; return; }
      const results = postsFromServer.filter(p => p.titulo.toLowerCase().includes(term) || p.categoria.toLowerCase().includes(term));
      if(results.length === 0) { searchResPreview.innerHTML = '<div class="text-center p-3 text-gray-400">Nenhum resultado encontrado 😢</div>'; return; }
      searchResPreview.innerHTML = results.slice(0,5).map(p => \`
        <div class="flex gap-2 p-2 border-b dark:border-gray-700">
          <img src="\${p.imagem}" class="w-12 h-12 rounded-md object-cover">
          <div><a href="/post/\${p.slug}" class="font-medium text-sm hover:text-primary">\${p.titulo}</a><p class="text-xs text-gray-500">\${p.categoria}</p></div>
        </div>
      \`).join('');
    }
    searchInput?.addEventListener('input', updateSearch);
    
    const mobileMenu = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('globalOverlay');
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => { mobileMenu.classList.add('open'); overlay.classList.add('opacity-100','visible'); });
    document.getElementById('closeMenuBtn')?.addEventListener('click', () => { mobileMenu.classList.remove('open'); overlay.classList.remove('opacity-100','visible'); });
    overlay?.addEventListener('click', () => { mobileMenu.classList.remove('open'); overlay.classList.remove('opacity-100','visible'); });
    
    const searchModal = document.getElementById('searchModal');
    document.getElementById('searchToggleBtn')?.addEventListener('click', () => { searchModal.classList.add('active'); overlay.classList.add('opacity-100','visible'); });
    document.getElementById('closeSearchBtn')?.addEventListener('click', () => { searchModal.classList.remove('active'); overlay.classList.remove('opacity-100','visible'); });
    
    const darkToggle = document.getElementById('darkModeToggle');
    if(localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    darkToggle?.addEventListener('click', () => {
      if(document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
      } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
      }
    });
    
    const header = document.getElementById('mainHeader');
    const backBtn = document.getElementById('backToTop');
    window.addEventListener('scroll', () => {
      if(window.scrollY > 80) header?.classList.add('sticky-header', 'shadow-md');
      else header?.classList.remove('sticky-header', 'shadow-md');
      if(window.scrollY > 400) backBtn?.classList.add('show');
      else backBtn?.classList.remove('show');
    });
    backBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    
    renderPosts();
  </script>
</body>
</html>`);
});

// =============================================================
// PÁGINA DO POST - COM SEO
// =============================================================
app.get('/post/:slug', (req, res) => {
  const posts = lerPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  
  if (!post) {
    return res.status(404).send('<h1>Post não encontrado</h1><a href="/">Voltar</a>');
  }
  
  // Incrementar visualizações
  post.visualizacoes = (post.visualizacoes || 0) + 1;
  salvarPosts(posts);
  
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
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #f9fafb; }
    .dark body { background: #0f172a; }
    .article-content { line-height: 1.8; }
    .article-content p { margin-bottom: 1rem; }
    .article-content h2 { font-size: 1.5rem; margin: 1.5rem 0 1rem; font-weight: bold; }
    .article-content img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    .article-content ul, .article-content ol { margin: 1rem 0 1rem 2rem; }
  </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <a href="/" class="text-blue-600 hover:underline">← Voltar para o início</a>
    <article class="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 md:p-8 mt-4">
      <h1 class="text-3xl md:text-4xl font-bold mb-4">${post.titulo}</h1>
      <div class="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
        <span>👤 ${post.autor}</span>
        <span>📅 ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
        <span>👁️ ${post.visualizacoes || 0} visualizações</span>
        <span>🏷️ ${post.categoria}</span>
      </div>
      <img src="${post.imagem}" class="w-full rounded-xl mb-6" alt="${post.titulo}">
      <div class="article-content">${post.conteudo}</div>
    </article>
  </div>
</body>
</html>`);
});

// =============================================================
// CATEGORIA
// =============================================================
app.get('/categoria/:nome', (req, res) => {
  const posts = lerPosts();
  const filtrados = posts.filter(p => p.categoria === req.params.nome);
  
  let html = `<!DOCTYPE html><html><head><title>${req.params.nome} | ModoDigital</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 dark:bg-gray-900"><div class="container mx-auto px-4 py-8"><a href="/" class="text-blue-600">← Voltar</a><h1 class="text-3xl font-bold mt-4 mb-6">📁 ${req.params.nome}</h1>`;
  
  for (const p of filtrados) {
    html += `<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-3"><a href="/post/${p.slug}" class="text-xl font-bold hover:text-blue-600">${p.titulo}</a><p class="text-sm text-gray-500 mt-1">${new Date(p.data).toLocaleDateString('pt-BR')}</p></div>`;
  }
  
  if (filtrados.length === 0) html += '<p class="text-gray-500">Nenhum artigo nesta categoria.</p>';
  html += '</div></body></html>';
  res.send(html);
});

// =============================================================
// ADMIN
// =============================================================
let adminLogado = false;

app.get('/admin', (req, res) => {
  if (adminLogado) return res.redirect('/admin/dashboard');
  res.send(`<!DOCTYPE html><html><head><title>Login</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 flex items-center justify-center min-h-screen"><div class="bg-white p-8 rounded-2xl shadow w-96"><h1 class="text-2xl font-bold text-center mb-6">Login Admin</h1><form method="POST" action="/admin/login"><input type="password" name="senha" placeholder="Senha" class="w-full p-3 border rounded-xl mb-4"><button class="w-full bg-blue-600 text-white p-3 rounded-xl">Entrar</button></form></div></body></html>`);
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
  res.send(`<!DOCTYPE html><html><head><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100"><div class="container mx-auto px-4 py-8"><div class="bg-white rounded-2xl shadow p-6"><h1 class="text-2xl font-bold mb-4">Painel Admin</h1><p class="mb-4">Total: <strong>${posts.length}</strong> artigos</p><div class="flex gap-3 mb-6"><a href="/admin/novo" class="bg-green-600 text-white px-4 py-2 rounded">➕ Novo Artigo</a><a href="/admin/logout" class="bg-red-600 text-white px-4 py-2 rounded">🚪 Sair</a></div><h2 class="font-bold mb-2">Artigos:</h2>${lista || '<p>Nenhum artigo</p>'}</div></div></body></html>`);
});

app.get('/admin/novo', (req, res) => {
  if (!adminLogado) return res.redirect('/admin');
  res.send(`<!DOCTYPE html><html><head><title>Novo Artigo</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100"><div class="container mx-auto px-4 py-8 max-w-3xl"><div class="bg-white rounded-2xl shadow p-6"><h1 class="text-2xl font-bold mb-4">✏️ Criar Artigo</h1><form method="POST" action="/admin/novo"><input type="text" name="titulo" placeholder="Título" class="w-full p-3 border rounded-xl mb-3" required><select name="categoria" class="w-full p-3 border rounded-xl mb-3"><option value="Tecnologia">Tecnologia</option><option value="Marketing">Marketing</option><option value="Produtividade">Produtividade</option></select><input type="text" name="autor" placeholder="Autor" value="Admin" class="w-full p-3 border rounded-xl mb-3"><input type="text" name="imagem" placeholder="URL da imagem" class="w-full p-3 border rounded-xl mb-3"><textarea name="resumo" rows="2" placeholder="Resumo curto" class="w-full p-3 border rounded-xl mb-3" required></textarea><textarea name="conteudo" rows="10" placeholder="Conteúdo do artigo (HTML permitido)" class="w-full p-3 border rounded-xl mb-3" required></textarea><div class="flex gap-3"><button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-xl">Publicar</button><a href="/admin/dashboard" class="bg-gray-500 text-white px-6 py-2 rounded-xl">Cancelar</a></div></form></div></div></body></html>`);
});

app.post('/admin/novo', (req, res) => {
  if (!adminLogado) return res.redirect('/admin');
  const posts = lerPosts();
  const slug = criarSlug(req.body.titulo);
  const novoPost = {
    slug: slug,
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