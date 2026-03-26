// ============================================
// ModoDigital - Main JavaScript
// ============================================

// API Base URL
const API_URL = '/api';

// Global state
let currentPage = 1;
let isLoading = false;
let allPosts = [];
let currentFilter = 'all';
let postsPerPage = 6;

// ============================================
// DOM Elements
// ============================================
const elements = {
  // Header
  header: document.querySelector('.header'),
  menuBtn: document.getElementById('menuBtn'),
  drawer: document.getElementById('drawer'),
  drawerClose: document.getElementById('drawerClose'),
  overlay: document.getElementById('overlay'),
  searchBtn: document.getElementById('searchBtn'),
  searchModal: document.getElementById('searchModal'),
  searchClose: document.getElementById('searchClose'),
  searchInput: document.getElementById('searchInput'),
  searchResults: document.getElementById('searchResults'),
  darkModeBtn: document.getElementById('darkModeBtn'),
  
  // Home page
  featuredGrid: document.getElementById('featuredGrid'),
  postsContainer: document.getElementById('postsContainer'),
  loadMoreBtn: document.getElementById('loadMoreBtn'),
  endMessage: document.getElementById('endMessage'),
  filterBtns: document.querySelectorAll('.filter-btn'),
  
  // Sidebar
  popularList: document.getElementById('popularList'),
  tagsCloud: document.getElementById('tagsCloud'),
  
  // Back to top
  backToTop: document.getElementById('backToTop')
};

// ============================================
// Dark Mode
// ============================================
function initDarkMode() {
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (isDark) {
    document.body.classList.add('dark');
  }
  
  if (elements.darkModeBtn) {
    elements.darkModeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('darkMode', document.body.classList.contains('dark'));
    });
  }
}

// ============================================
// Header Scroll Effect
// ============================================
function initHeaderScroll() {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      elements.header?.classList.add('header-scrolled');
    } else {
      elements.header?.classList.remove('header-scrolled');
    }
  });
}

// ============================================
// Mobile Drawer
// ============================================
function initMobileDrawer() {
  const openDrawer = () => {
    elements.drawer?.classList.add('open');
    elements.overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  
  const closeDrawer = () => {
    elements.drawer?.classList.remove('open');
    elements.overlay?.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  elements.menuBtn?.addEventListener('click', openDrawer);
  elements.drawerClose?.addEventListener('click', closeDrawer);
  elements.overlay?.addEventListener('click', closeDrawer);
}

// ============================================
// Search Modal
// ============================================
function initSearchModal() {
  const openSearch = () => {
    elements.searchModal?.classList.add('active');
    elements.overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
    elements.searchInput?.focus();
  };
  
  const closeSearch = () => {
    elements.searchModal?.classList.remove('active');
    elements.overlay?.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  elements.searchBtn?.addEventListener('click', openSearch);
  elements.searchClose?.addEventListener('click', closeSearch);
  elements.overlay?.addEventListener('click', closeSearch);
  
  // Search input handler
  let searchTimeout;
  elements.searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value);
    }, 300);
  });
}

async function performSearch(query) {
  if (!query.trim()) {
    elements.searchResults.innerHTML = '';
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    const results = await response.json();
    
    if (results.length === 0) {
      elements.searchResults.innerHTML = `
        <div class="search-empty">
          <i class="fas fa-search"></i>
          <p>Nenhum resultado encontrado para "${query}"</p>
        </div>
      `;
      return;
    }
    
    elements.searchResults.innerHTML = results.map(post => `
      <a href="/post/${post.slug}" class="search-item" data-slug="${post.slug}">
        <img src="${post.imagem}" class="search-item-img" alt="${post.titulo}">
        <div class="search-item-info">
          <h4>${post.titulo}</h4>
          <p>${post.categoria} • ${new Date(post.data).toLocaleDateString('pt-BR')}</p>
        </div>
      </a>
    `).join('');
  } catch (error) {
    console.error('Search error:', error);
  }
}

// ============================================
// Back to Top
// ============================================
function initBackToTop() {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      elements.backToTop?.classList.add('show');
    } else {
      elements.backToTop?.classList.remove('show');
    }
  });
  
  elements.backToTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ============================================
// Load Posts
// ============================================
async function loadPosts() {
  try {
    const response = await fetch(`${API_URL}/posts`);
    allPosts = await response.json();
    return allPosts;
  } catch (error) {
    console.error('Error loading posts:', error);
    return [];
  }
}

// ============================================
// Render Featured Posts
// ============================================
function renderFeatured(posts) {
  if (!elements.featuredGrid) return;
  
  const featured = posts.slice(0, 3);
  if (featured.length === 0) {
    elements.featuredGrid.innerHTML = '<p class="col-span-3 text-center">Nenhum post em destaque</p>';
    return;
  }
  
  elements.featuredGrid.innerHTML = featured.map(post => `
    <div class="featured-card" data-slug="${post.slug}">
      <img src="${post.imagem}" alt="${post.titulo}">
      <div class="featured-overlay">
        <span class="featured-category">${post.categoria}</span>
        <h3 class="featured-title">${post.titulo}</h3>
        <span class="featured-date">${new Date(post.data).toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.featured-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.dataset.slug;
      window.location.href = `/post/${slug}`;
    });
  });
}

// ============================================
// Render Posts Grid
// ============================================
function renderPosts(posts, reset = true) {
  if (!elements.postsContainer) return;
  
  if (reset) {
    currentPage = 1;
    elements.postsContainer.innerHTML = '';
  }
  
  const start = 0;
  const end = currentPage * postsPerPage;
  const postsToShow = posts.slice(start, end);
  
  if (reset) {
    elements.postsContainer.innerHTML = postsToShow.map(post => `
      <div class="post-card" data-slug="${post.slug}">
        <img src="${post.imagem}" class="post-card-img" alt="${post.titulo}">
        <div class="post-card-content">
          <span class="post-card-category">${post.categoria}</span>
          <h3 class="post-card-title">${post.titulo}</h3>
          <p class="post-card-excerpt">${post.resumo}</p>
          <div class="post-card-meta">
            <span><i class="fas fa-user"></i> ${post.autor}</span>
            <span><i class="fas fa-calendar"></i> ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
            <span><i class="fas fa-eye"></i> ${post.visualizacoes || 0}</span>
          </div>
        </div>
      </div>
    `).join('');
  } else {
    postsToShow.forEach(post => {
      const card = document.createElement('div');
      card.className = 'post-card';
      card.setAttribute('data-slug', post.slug);
      card.innerHTML = `
        <img src="${post.imagem}" class="post-card-img" alt="${post.titulo}">
        <div class="post-card-content">
          <span class="post-card-category">${post.categoria}</span>
          <h3 class="post-card-title">${post.titulo}</h3>
          <p class="post-card-excerpt">${post.resumo}</p>
          <div class="post-card-meta">
            <span><i class="fas fa-user"></i> ${post.autor}</span>
            <span><i class="fas fa-calendar"></i> ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
            <span><i class="fas fa-eye"></i> ${post.visualizacoes || 0}</span>
          </div>
        </div>
      `;
      elements.postsContainer.appendChild(card);
    });
  }
  
  // Add click handlers
  document.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.dataset.slug;
      window.location.href = `/post/${slug}`;
    });
  });
  
  // Update load more button
  const hasMore = posts.length > currentPage * postsPerPage;
  if (elements.loadMoreBtn) {
    elements.loadMoreBtn.style.display = hasMore ? 'block' : 'none';
  }
  if (elements.endMessage) {
    elements.endMessage.style.display = hasMore ? 'none' : 'block';
  }
}

// ============================================
// Load More
// ============================================
function initLoadMore() {
  if (!elements.loadMoreBtn) return;
  
  elements.loadMoreBtn.addEventListener('click', async () => {
    if (isLoading) return;
    isLoading = true;
    
    currentPage++;
    
    let filteredPosts = allPosts;
    if (currentFilter !== 'all') {
      filteredPosts = allPosts.filter(p => p.categoria === currentFilter);
    }
    
    renderPosts(filteredPosts, false);
    isLoading = false;
  });
}

// ============================================
// Filter Posts
// ============================================
function initFilters() {
  if (!elements.filterBtns.length) return;
  
  elements.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      currentFilter = filter;
      
      // Update active state
      elements.filterBtns.forEach(b => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      
      // Filter posts
      let filtered = allPosts;
      if (filter !== 'all') {
        filtered = allPosts.filter(p => p.categoria === filter);
      }
      
      renderPosts(filtered, true);
    });
  });
}

// ============================================
// Render Popular Posts (Sidebar)
// ============================================
async function renderPopularPosts() {
  if (!elements.popularList) return;
  
  try {
    const response = await fetch(`${API_URL}/popular`);
    const popular = await response.json();
    
    if (popular.length === 0) {
      elements.popularList.innerHTML = '<p>Nenhum post popular ainda</p>';
      return;
    }
    
    elements.popularList.innerHTML = popular.map(post => `
      <a href="/post/${post.slug}" class="popular-item" data-slug="${post.slug}">
        <img src="${post.imagem}" class="popular-item-img" alt="${post.titulo}">
        <div class="popular-item-info">
          <h4>${post.titulo}</h4>
          <p>${new Date(post.data).toLocaleDateString('pt-BR')}</p>
        </div>
      </a>
    `).join('');
  } catch (error) {
    console.error('Error loading popular posts:', error);
  }
}

// ============================================
// Render Tags Cloud
// ============================================
async function renderTagsCloud() {
  if (!elements.tagsCloud) return;
  
  try {
    const response = await fetch(`${API_URL}/categories`);
    const categories = await response.json();
    
    if (categories.length === 0) {
      elements.tagsCloud.innerHTML = '<p>Nenhuma tag disponível</p>';
      return;
    }
    
    elements.tagsCloud.innerHTML = categories.map(cat => `
      <a href="/category/${cat}" class="tag">#${cat}</a>
    `).join('');
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// ============================================
// Newsletter Subscription
// ============================================
function initNewsletter() {
  const newsletterForm = document.getElementById('newsletterForm');
  if (!newsletterForm) return;
  
  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = newsletterForm.querySelector('input')?.value;
    if (email) {
      alert(`Obrigado por se inscrever! Enviaremos novidades para ${email}`);
      newsletterForm.reset();
    }
  });
}

// ============================================
// Smooth Scroll for Anchor Links
// ============================================
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ============================================
// Lazy Loading Images
// ============================================
function initLazyLoading() {
  const images = document.querySelectorAll('img[data-src]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });
  
  images.forEach(img => observer.observe(img));
}

// ============================================
// Initialize Home Page
// ============================================
async function initHomePage() {
  await loadPosts();
  renderFeatured(allPosts);
  renderPosts(allPosts, true);
  initLoadMore();
  initFilters();
  await renderPopularPosts();
  await renderTagsCloud();
}

// ============================================
// Initialize Article Page
// ============================================
async function initArticlePage() {
  const slug = window.location.pathname.split('/').pop();
  
  try {
    const response = await fetch(`${API_URL}/posts/${slug}`);
    const post = await response.json();
    
    if (!post || post.error) {
      window.location.href = '/';
      return;
    }
    
    // Update page title
    document.title = `${post.titulo} | ModoDigital`;
    
    // Render article content
    document.getElementById('articleCategory').textContent = post.categoria;
    document.getElementById('articleTitle').textContent = post.titulo;
    document.getElementById('articleAuthor').innerHTML = `<i class="fas fa-user"></i> ${post.autor}`;
    document.getElementById('articleDate').innerHTML = `<i class="fas fa-calendar"></i> ${new Date(post.data).toLocaleDateString('pt-BR')}`;
    document.getElementById('articleViews').innerHTML = `<i class="fas fa-eye"></i> ${post.visualizacoes || 0} visualizações`;
    document.getElementById('articleImage').src = post.imagem;
    document.getElementById('articleImage').alt = post.titulo;
    document.getElementById('articleContent').innerHTML = post.conteudo;
    
    // Update share buttons
    const url = window.location.href;
    const title = encodeURIComponent(post.titulo);
    
    const shareButtons = document.querySelectorAll('.share-btn');
    shareButtons.forEach(btn => {
      if (btn.classList.contains('share-facebook')) {
        btn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      } else if (btn.classList.contains('share-twitter')) {
        btn.href = `https://twitter.com/intent/tweet?text=${title}&url=${encodeURIComponent(url)}`;
      } else if (btn.classList.contains('share-whatsapp')) {
        btn.href = `https://wa.me/?text=${title}%20-%20${encodeURIComponent(url)}`;
      } else if (btn.classList.contains('share-linkedin')) {
        btn.href = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${title}`;
      } else if (btn.classList.contains('share-email')) {
        btn.href = `mailto:?subject=${title}&body=Confira este artigo: ${url}`;
      }
    });
    
    // Copy link button
    const copyBtn = document.getElementById('copyLinkBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(url);
        alert('Link copiado para a área de transferência!');
      });
    }
    
    // Load related posts
    await loadRelatedPosts(post.categoria, post.slug);
    
  } catch (error) {
    console.error('Error loading article:', error);
    window.location.href = '/';
  }
}

async function loadRelatedPosts(category, currentSlug) {
  const relatedContainer = document.getElementById('relatedPosts');
  if (!relatedContainer) return;
  
  try {
    const response = await fetch(`${API_URL}/posts`);
    const posts = await response.json();
    const related = posts
      .filter(p => p.categoria === category && p.slug !== currentSlug)
      .slice(0, 3);
    
    if (related.length === 0) {
      relatedContainer.innerHTML = '<p>Nenhum post relacionado encontrado.</p>';
      return;
    }
    
    relatedContainer.innerHTML = related.map(post => `
      <div class="post-card" data-slug="${post.slug}">
        <img src="${post.imagem}" class="post-card-img" alt="${post.titulo}">
        <div class="post-card-content">
          <span class="post-card-category">${post.categoria}</span>
          <h3 class="post-card-title">${post.titulo}</h3>
          <p class="post-card-excerpt">${post.resumo}</p>
          <div class="post-card-meta">
            <span><i class="fas fa-calendar"></i> ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>
    `).join('');
    
    document.querySelectorAll('#relatedPosts .post-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.href = `/post/${card.dataset.slug}`;
      });
    });
    
  } catch (error) {
    console.error('Error loading related posts:', error);
  }
}

// ============================================
// Initialize Category Page
// ============================================
async function initCategoryPage() {
  const categoryName = window.location.pathname.split('/').pop();
  
  try {
    const response = await fetch(`${API_URL}/category/${categoryName}`);
    const posts = await response.json();
    
    document.title = `${categoryName} | ModoDigital`;
    document.getElementById('categoryName').textContent = categoryName;
    document.getElementById('categoryCount').textContent = `${posts.length} artigo${posts.length !== 1 ? 's' : ''}`;
    
    const container = document.getElementById('categoryPosts');
    if (posts.length === 0) {
      container.innerHTML = '<div class="text-center py-8"><p>Nenhum artigo encontrado nesta categoria.</p><a href="/" class="tag mt-4 inline-block">Voltar para o início</a></div>';
      return;
    }
    
    container.innerHTML = posts.map(post => `
      <div class="post-card" data-slug="${post.slug}">
        <img src="${post.imagem}" class="post-card-img" alt="${post.titulo}">
        <div class="post-card-content">
          <span class="post-card-category">${post.categoria}</span>
          <h3 class="post-card-title">${post.titulo}</h3>
          <p class="post-card-excerpt">${post.resumo}</p>
          <div class="post-card-meta">
            <span><i class="fas fa-user"></i> ${post.autor}</span>
            <span><i class="fas fa-calendar"></i> ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
            <span><i class="fas fa-eye"></i> ${post.visualizacoes || 0}</span>
          </div>
        </div>
      </div>
    `).join('');
    
    document.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.href = `/post/${card.dataset.slug}`;
      });
    });
    
  } catch (error) {
    console.error('Error loading category:', error);
  }
}

// ============================================
// Initialize Search Page
// ============================================
async function initSearchPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  
  if (!query) {
    window.location.href = '/';
    return;
  }
  
  document.title = `Busca: ${query} | ModoDigital`;
  document.getElementById('searchQuery').textContent = query;
  
  try {
    const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    const results = await response.json();
    
    document.getElementById('searchCount').textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
    
    const container = document.getElementById('searchResults');
    if (results.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8">
          <i class="fas fa-search" style="font-size: 3rem; color: var(--gray);"></i>
          <p class="mt-4">Nenhum resultado encontrado para "${query}"</p>
          <p class="text-gray-500">Tente usar palavras-chave diferentes ou navegue pelas categorias.</p>
          <a href="/" class="tag mt-4 inline-block">Voltar para o início</a>
        </div>
      `;
      return;
    }
    
    container.innerHTML = results.map(post => `
      <div class="post-card" data-slug="${post.slug}">
        <img src="${post.imagem}" class="post-card-img" alt="${post.titulo}">
        <div class="post-card-content">
          <span class="post-card-category">${post.categoria}</span>
          <h3 class="post-card-title">${post.titulo}</h3>
          <p class="post-card-excerpt">${post.resumo}</p>
          <div class="post-card-meta">
            <span><i class="fas fa-user"></i> ${post.autor}</span>
            <span><i class="fas fa-calendar"></i> ${new Date(post.data).toLocaleDateString('pt-BR')}</span>
            <span><i class="fas fa-eye"></i> ${post.visualizacoes || 0}</span>
          </div>
        </div>
      </div>
    `).join('');
    
    document.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.href = `/post/${card.dataset.slug}`;
      });
    });
    
  } catch (error) {
    console.error('Error searching:', error);
  }
}

// ============================================
// Route Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize common components
  initDarkMode();
  initHeaderScroll();
  initMobileDrawer();
  initSearchModal();
  initBackToTop();
  initNewsletter();
  initSmoothScroll();
  initLazyLoading();
  
  // Page-specific initialization
  const path = window.location.pathname;
  
  if (path === '/') {
    initHomePage();
  } else if (path.startsWith('/post/')) {
    initArticlePage();
  } else if (path.startsWith('/category/')) {
    initCategoryPage();
  } else if (path === '/search') {
    initSearchPage();
  }
});

// ============================================
// Service Worker (PWA)
// ============================================
if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}