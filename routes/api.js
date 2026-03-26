const express = require('express');
const router = express.Router();
const RedisService = require('../services/redisService');
const sanitizeHtml = require('sanitize-html');

// Listar artigos (API)
router.get('/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const category = req.query.category;
    const search = req.query.search;
    
    const data = await RedisService.listArticles(page, 12, category, search);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter artigo por slug
router.get('/articles/:slug', async (req, res) => {
  try {
    const article = await RedisService.getArticle(req.params.slug);
    if (!article) {
      return res.status(404).json({ error: 'Artigo não encontrado' });
    }
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar artigo (admin)
router.post('/articles', async (req, res) => {
  try {
    const { title, content, excerpt, coverImage, coverAlt, author, category, tags, metaTitle, metaDescription, keywords, published } = req.body;
    
    // Sanitizar HTML
    const sanitizedContent = sanitizeHtml(content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3']),
      allowedAttributes: {
        '*': ['class', 'style'],
        img: ['src', 'alt', 'title'],
        a: ['href', 'target']
      }
    });
    
    const article = await RedisService.createArticle({
      title,
      content: sanitizedContent,
      excerpt,
      coverImage,
      coverAlt,
      author,
      category,
      tags: JSON.stringify(tags || []),
      metaTitle,
      metaDescription,
      keywords,
      published: published === 'true'
    });
    
    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar artigo
router.put('/articles/:slug', async (req, res) => {
  try {
    const article = await RedisService.updateArticle(req.params.slug, req.body);
    if (!article) {
      return res.status(404).json({ error: 'Artigo não encontrado' });
    }
    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar artigo
router.delete('/articles/:slug', async (req, res) => {
  try {
    const deleted = await RedisService.deleteArticle(req.params.slug);
    if (!deleted) {
      return res.status(404).json({ error: 'Artigo não encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas
router.get('/stats', async (req, res) => {
  try {
    const total = await RedisService.listArticles(1, 1000);
    const popular = await RedisService.getPopularArticles(10);
    
    res.json({
      totalArticles: total.total,
      popularArticles: popular,
      categories: await RedisService.getCategories()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;