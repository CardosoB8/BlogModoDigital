const express = require('express');
const router = express.Router();
const RedisService = require('../services/redisService');
const SeoMiddleware = require('../middleware/seo');
const { cachePage } = require('../middleware/cache');

router.use(SeoMiddleware.injectMetaTags.bind(SeoMiddleware));

// Homepage
router.get('/', cachePage, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const category = req.query.categoria || null;
    const search = req.query.q || null;
    
    const { articles, total, totalPages } = await RedisService.listArticles(page, 12, category, search);
    const popular = await RedisService.getPopularArticles(5);
    
    const metaTags = SeoMiddleware.generateMetaTags(res);
    const jsonLd = SeoMiddleware.generateJsonLd(res);
    
    res.render('index', {
      articles,
      popular,
      totalPages,
      currentPage: page,
      category,
      search,
      metaTags,
      jsonLd,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Artigo individual
router.get('/artigo/:slug', cachePage, async (req, res) => {
  try {
    const article = await RedisService.getArticle(req.params.slug);
    
    if (!article || article.published === 'false') {
      return res.status(404).render('404', {
        metaTags: SeoMiddleware.generateMetaTags(res),
        siteConfig: res.locals.siteConfig
      });
    }
    
    const related = await RedisService.getRelatedArticles(article.category, article.slug, 3);
    const metaTags = SeoMiddleware.generateMetaTags(res);
    const jsonLd = SeoMiddleware.generateJsonLd(res);
    const breadcrumbs = SeoMiddleware.generateBreadcrumbs(res);
    
    res.render('article', {
      article,
      related,
      metaTags,
      jsonLd,
      breadcrumbs,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Categoria
router.get('/categoria/:category', cachePage, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const { articles, totalPages } = await RedisService.listArticles(page, 12, req.params.category);
    
    const metaTags = SeoMiddleware.generateMetaTags(res);
    
    res.render('category', {
      articles,
      category: req.params.category,
      totalPages,
      currentPage: page,
      metaTags,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Busca
router.get('/buscar', cachePage, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.redirect('/');
    
    const { articles } = await RedisService.listArticles(1, 50, null, q);
    
    const metaTags = SeoMiddleware.generateMetaTags(res);
    
    res.render('search', {
      articles,
      query: q,
      metaTags,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Sitemap
router.get('/sitemap.xml', async (req, res) => {
  res.sendFile('sitemap.xml', { root: './public' });
});

// Robots.txt
router.get('/robots.txt', async (req, res) => {
  res.sendFile('robots.txt', { root: './public' });
});

module.exports = router;