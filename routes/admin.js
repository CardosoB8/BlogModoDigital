const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const RedisService = require('../services/redisService');
const { isAuthenticated } = require('../middleware/auth');
const { generateSitemap } = require('../services/sitemapService');
const marked = require('marked');

// Configurar marked para preview
marked.setOptions({
  breaks: true,
  gfm: true
});

// Login page
router.get('/login', (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { error: 'Senha incorreta' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Todas as rotas abaixo exigem autenticação
router.use(isAuthenticated);

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { articles, total } = await RedisService.listArticles(1, 1000);
    const popular = await RedisService.getPopularArticles(5);
    const categories = {};
    
    for (const article of articles) {
      const cat = article.category;
      categories[cat] = (categories[cat] || 0) + 1;
    }
    
    res.render('admin/dashboard', {
      totalArticles: total,
      popularArticles: popular,
      categories: Object.entries(categories),
      recentArticles: articles.slice(0, 5)
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Listar artigos
router.get('/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search;
    const { articles, total, totalPages } = await RedisService.listArticles(page, 20, null, search);
    
    res.render('admin/articles', {
      articles,
      total,
      totalPages,
      currentPage: page,
      search: search || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Criar artigo
router.get('/articles/new', (req, res) => {
  res.render('admin/edit', {
    article: null,
    isNew: true
  });
});

router.post('/articles/new', async (req, res) => {
  try {
    const { title, content, excerpt, coverImage, coverAlt, author, category, tags, metaTitle, metaDescription, keywords, published } = req.body;
    
    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];
    
    const article = await RedisService.createArticle({
      title,
      content,
      excerpt: excerpt || content.substring(0, 160),
      coverImage: coverImage || 'https://picsum.photos/id/1/1200/630',
      coverAlt: coverAlt || title,
      author: author || 'Admin',
      category,
      tags: tagsArray,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt,
      keywords: keywords || category,
      published: published === 'on'
    });
    
    // Gerar sitemap após novo artigo
    await generateSitemap();
    
    res.redirect('/admin/articles');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao criar artigo');
  }
});

// Editar artigo
router.get('/articles/edit/:slug', async (req, res) => {
  try {
    const article = await RedisService.getArticle(req.params.slug);
    if (!article) {
      return res.status(404).send('Artigo não encontrado');
    }
    
    // Parse tags de volta para string
    if (article.tags && typeof article.tags === 'string') {
      try {
        article.tagsArray = JSON.parse(article.tags).join(', ');
      } catch {
        article.tagsArray = article.tags;
      }
    }
    
    res.render('admin/edit', {
      article,
      isNew: false
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

router.post('/articles/edit/:slug', async (req, res) => {
  try {
    const { title, content, excerpt, coverImage, coverAlt, author, category, tags, metaTitle, metaDescription, keywords, published } = req.body;
    
    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];
    
    await RedisService.updateArticle(req.params.slug, {
      title,
      content,
      excerpt,
      coverImage,
      coverAlt,
      author,
      category,
      tags: tagsArray,
      metaTitle,
      metaDescription,
      keywords,
      published: published === 'on'
    });
    
    // Gerar sitemap após edição
    await generateSitemap();
    
    res.redirect('/admin/articles');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao atualizar artigo');
  }
});

// Preview do artigo
router.post('/articles/preview', async (req, res) => {
  try {
    const { content, title } = req.body;
    const htmlContent = marked.parse(content || '');
    
    res.json({
      title: title || 'Preview do Artigo',
      content: htmlContent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar artigo
router.post('/articles/delete/:slug', async (req, res) => {
  try {
    await RedisService.deleteArticle(req.params.slug);
    await generateSitemap();
    res.redirect('/admin/articles');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao deletar artigo');
  }
});

// Configurações do site
router.get('/settings', async (req, res) => {
  try {
    const config = await RedisService.getSiteConfig();
    res.render('admin/settings', { config });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { title, description, keywords, siteUrl } = req.body;
    await RedisService.saveSiteConfig({
      title,
      description,
      keywords,
      siteUrl
    });
    res.redirect('/admin/settings?success=1');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao salvar configurações');
  }
});

module.exports = router;