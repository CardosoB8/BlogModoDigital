<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>ModoDigital | Blog de Tecnologia & Marketing Digital</title>
  <meta name="description" content="Dicas e tutoriais para sua vida digital. Tecnologia, marketing e produtividade em um só lugar.">
  <meta name="keywords" content="blog, tecnologia, marketing digital, produtividade, tutoriais">
  <meta name="author" content="ModoDigital">
  <meta property="og:title" content="ModoDigital | Blog de Tecnologia & Marketing Digital">
  <meta property="og:description" content="Dicas e tutoriais para sua vida digital">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://mododigital.com">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <!-- Header -->
  <header class="header" id="mainHeader">
    <div class="header-container">
      <a href="/" class="logo">Modo<span>Digital</span></a>
      <nav class="nav-desktop">
        <a href="/" class="active">Início</a>
        <a href="/category/Tecnologia">Tecnologia</a>
        <a href="/category/Marketing">Marketing</a>
        <a href="/category/Produtividade">Produtividade</a>
      </nav>
      <div class="header-actions">
        <button class="header-btn" id="searchBtn" aria-label="Buscar">
          <i class="fas fa-search"></i>
        </button>
        <button class="header-btn" id="darkModeBtn" aria-label="Modo escuro">
          <i class="fas fa-moon"></i>
        </button>
        <button class="menu-btn" id="menuBtn" aria-label="Menu">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Drawer (Sidebar Esquerda) -->
  <div class="drawer" id="drawer">
    <div class="drawer-header">
      <a href="/" class="drawer-logo">Modo<span>Digital</span></a>
      <button class="drawer-close" id="drawerClose">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <nav class="drawer-nav">
      <a href="/"><i class="fas fa-home"></i> Início</a>
      <a href="/category/Tecnologia"><i class="fas fa-microchip"></i> Tecnologia</a>
      <a href="/category/Marketing"><i class="fas fa-chart-line"></i> Marketing</a>
      <a href="/category/Produtividade"><i class="fas fa-rocket"></i> Produtividade</a>
      <a href="/search"><i class="fas fa-search"></i> Buscar</a>
    </nav>
    <div class="drawer-footer">
      <div class="drawer-social">
        <a href="#" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="#" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
        <a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
        <a href="#" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
      </div>
      <p class="drawer-copyright">© 2026 ModoDigital</p>
    </div>
  </div>

  <!-- Overlay -->
  <div class="overlay" id="overlay"></div>

  <!-- Search Modal -->
  <div class="search-modal" id="searchModal">
    <div class="search-header">
      <h3><i class="fas fa-search"></i> Buscar artigos</h3>
      <button class="search-close" id="searchClose">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="search-input-wrapper">
      <input type="text" class="search-input" id="searchInput" placeholder="Digite título, categoria ou palavras-chave...">
    </div>
    <div class="search-results" id="searchResults"></div>
  </div>

  <!-- Main Content -->
  <main class="main">
    <div class="container">
      <!-- Hero Section -->
      <div class="hero fade-in-up">
        <h1 class="gradient-text">ModoDigital</h1>
        <p>Dicas e tutoriais para acelerar sua vida digital</p>
      </div>

      <!-- Featured Section -->
      <div class="section-title">
        <i class="fas fa-star"></i>
        <h2>Destaques da Semana</h2>
      </div>
      <div class="featured-grid" id="featuredGrid"></div>

      <!-- Blog Layout -->
      <div class="blog-layout">
        <!-- Main Content Area -->
        <div>
          <div class="section-title">
            <i class="fas fa-newspaper"></i>
            <h2>Últimos Artigos</h2>
          </div>
          <div class="posts-grid" id="postsContainer"></div>
          <div class="load-more" id="loadMoreBtn">
            <button class="load-more-btn">Carregar mais <i class="fas fa-arrow-down"></i></button>
          </div>
          <div class="end-message" id="endMessage" style="display: none;">
            <i class="fas fa-check-circle"></i>
            <p>Todos os artigos foram carregados!</p>
          </div>
        </div>

        <!-- Sidebar -->
        <aside class="sidebar">
          <!-- Newsletter Widget -->
          <div class="sidebar-widget">
            <h3 class="widget-title"><i class="fas fa-envelope"></i> Newsletter</h3>
            <p>Receba as novidades em primeira mão!</p>
            <form class="newsletter-form" id="newsletterForm">
              <input type="email" class="newsletter-input" placeholder="Seu melhor e-mail" required>
              <button type="submit" class="newsletter-btn">Inscrever-se</button>
            </form>
          </div>

          <!-- Popular Posts Widget -->
          <div class="sidebar-widget">
            <h3 class="widget-title"><i class="fas fa-fire"></i> Mais Lidos</h3>
            <div class="popular-list" id="popularList"></div>
          </div>

          <!-- Tags Cloud Widget -->
          <div class="sidebar-widget">
            <h3 class="widget-title"><i class="fas fa-tags"></i> Tags em Alta</h3>
            <div class="tags-cloud" id="tagsCloud"></div>
          </div>
        </aside>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-brand">
        <h3>Modo<span style="color: var(--primary);">Digital</span></h3>
        <p>Conteúdo inteligente para acelerar sua vida digital.</p>
        <div class="footer-social">
          <a href="#"><i class="fab fa-facebook-f"></i></a>
          <a href="#"><i class="fab fa-twitter"></i></a>
          <a href="#"><i class="fab fa-instagram"></i></a>
          <a href="#"><i class="fab fa-youtube"></i></a>
        </div>
      </div>
      <div class="footer-links">
        <h4>Links Rápidos</h4>
        <ul>
          <li><a href="/">Início</a></li>
          <li><a href="/category/Tecnologia">Tecnologia</a></li>
          <li><a href="/category/Marketing">Marketing</a></li>
          <li><a href="/category/Produtividade">Produtividade</a></li>
        </ul>
      </div>
      <div class="footer-links">
        <h4>Legal</h4>
        <ul>
          <li><a href="#">Sobre nós</a></li>
          <li><a href="#">Política de Privacidade</a></li>
          <li><a href="#">Termos de Uso</a></li>
          <li><a href="#">Contato</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 ModoDigital. Criado com <i class="fas fa-heart" style="color: var(--danger);"></i> por Vailink.pro</p>
    </div>
  </footer>

  <!-- Back to Top Button -->
  <button class="back-to-top" id="backToTop">
    <i class="fas fa-arrow-up"></i>
  </button>

  <script src="/js/main.js"></script>
</body>
</html>