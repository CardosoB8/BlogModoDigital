const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const compression = require('compression');
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// =================================================================
// CONFIGURAÇÕES DE SEGURANÇA
// =================================================================
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
    },
  },
}));

app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições, tente novamente em 15 minutos.' }
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================
// CONFIGURAÇÃO DO REDIS
// =================================================================
let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://default:JyefUsxHJljfdvs8HACumEyLE7XNgLvG@redis-19242.c266.us-east-1-3.ec2.cloud.redislabs.com:19242',
      socket: {
        reconnectStrategy: false
      }
    });
    
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    redisClient.on('connect', () => console.log('✅ Redis conectado!'));
    
    await redisClient.connect();
  }
  return redisClient;
}

// Sessão com Redis
app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: process.env.SESSION_SECRET || 'minha_chave_super_secreta_123456789',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// =================================================================
// CONFIGURAÇÃO DO EJS
// =================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para injetar config do site
app.use(async (req, res, next) => {
  try {
    const redis = await getRedisClient();
    let config = await redis.hgetall('site:config');
    
    if (!config || Object.keys(config).length === 0) {
      config = {
        title: process.env.SITE_TITLE || 'ModoDigital',
        description: process.env.SITE_DESCRIPTION || 'Dicas e tutoriais para sua vida digital',
        keywords: 'blog, tecnologia, marketing, produtividade',
        siteUrl: process.env.SITE_URL || 'https://blog-modo-digital.vercel.app'
      };
      await redis.hset('site:config', config);
    }
    
    res.locals.siteConfig = config;
    res.locals.currentUrl = `${config.siteUrl}${req.originalUrl}`;
    next();
  } catch (error) {
    console.error('Erro config:', error);
    res.locals.siteConfig = {
      title: 'ModoDigital',
      description: 'Dicas e tutoriais',
      siteUrl: 'https://blog-modo-digital.vercel.app'
    };
    next();
  }
});

// =================================================================
// FUNÇÕES DE ARTIGOS
// =================================================================
class ArticleService {
  static async createArticle(data) {
    const redis = await getRedisClient();
    const id = uuidv4();
    const slug = slugify(data.title, { lower: true, strict: true });
    const now = new Date().toISOString();
    
    const article = {
      id,
      slug,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt || data.content.substring(0, 160),
      coverImage: data.coverImage || 'https://picsum.photos/id/1/1200/630',
      coverAlt: data.coverAlt || data.title,
      author: data.author || 'Admin',
      category: data.category,
      tags: JSON.stringify(data.tags || []),
      metaTitle: data.metaTitle || data.title,
      metaDescription: data.metaDescription || data.excerpt,
      keywords: data.keywords || data.category,
      published: data.published !== false ? 'true' : 'false',
      createdAt: now,
      updatedAt: now,
      views: '0'
    };
    
    await redis.hset(`article:${slug}`, article);
    await redis.sadd('articles:all', slug);
    
    if (article.published === 'true') {
      await redis.zadd('articles:published', Date.now(), slug);
      await redis.sadd(`articles:category:${article.category}`, slug);
      if (data.tags) {
        for (const tag of data.tags) {
          await redis.sadd(`articles:tag:${tag}`, slug);
        }
      }
    }
    
    return article;
  }
  
  static async getArticle(slug) {
    const redis = await getRedisClient();
    const article = await redis.hgetall(`article:${slug}`);
    
    if (!article || Object.keys(article).length === 0) return null;
    
    const views = parseInt(article.views || '0') + 1;
    await redis.hset(`article:${slug}`, 'views', views.toString());
    await redis.zincrby('articles:views', 1, slug);
    
    return article;
  }
  
  static async listArticles(page = 1, limit = 10, category = null, search = null) {
    const redis = await getRedisClient();
    let slugs = [];
    
    if (category && category !== 'all') {
      slugs = await redis.smembers(`articles:category:${category}`);
    } else {
      slugs = await redis.zrevrange('articles:published', 0, -1);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      const filtered = [];
      for (const slug of slugs) {
        const article = await this.getArticle(slug);
        if (article && article.title && 
            (article.title.toLowerCase().includes(searchLower) || 
             (article.excerpt && article.excerpt.toLowerCase().includes(searchLower)))) {
          filtered.push(slug);
        }
      }
      slugs = filtered;
    }
    
    const start = (page - 1) * limit;
    const paginatedSlugs = slugs.slice(start, start + limit);
    
    const articles = [];
    for (const slug of paginatedSlugs) {
      const article = await this.getArticle(slug);
      if (article && article.published === 'true') {
        articles.push(article);
      }
    }
    
    return {
      articles,
      total: slugs.length,
      page,
      totalPages: Math.ceil(slugs.length / limit)
    };
  }
  
  static async getPopularArticles(limit = 5) {
    const redis = await getRedisClient();
    const slugs = await redis.zrevrange('articles:views', 0, limit - 1);
    const articles = [];
    
    for (const slug of slugs) {
      const article = await this.getArticle(slug);
      if (article) articles.push(article);
    }
    
    return articles;
  }
  
  static async getRelatedArticles(category, currentSlug, limit = 3) {
    const redis = await getRedisClient();
    const slugs = await redis.smembers(`articles:category:${category}`);
    const filtered = slugs.filter(slug => slug !== currentSlug).slice(0, limit);
    const articles = [];
    
    for (const slug of filtered) {
      const article = await this.getArticle(slug);
      if (article && article.published === 'true') articles.push(article);
    }
    
    return articles;
  }
  
  static async updateArticle(slug, updates) {
    const redis = await getRedisClient();
    const oldArticle = await this.getArticle(slug);
    if (!oldArticle) return null;
    
    let newSlug = slug;
    if (updates.title && updates.title !== oldArticle.title) {
      newSlug = slugify(updates.title, { lower: true, strict: true });
      const oldData = await redis.hgetall(`article:${slug}`);
      await redis.hset(`article:${newSlug}`, oldData);
      await redis.del(`article:${slug}`);
      
      await redis.srem('articles:all', slug);
      await redis.sadd('articles:all', newSlug);
      if (oldArticle.published === 'true') {
        await redis.zrem('articles:published', slug);
        await redis.zadd('articles:published', Date.now(), newSlug);
      }
    }
    
    updates.updatedAt = new Date().toISOString();
    await redis.hset(`article:${newSlug}`, updates);
    
    return this.getArticle(newSlug);
  }
  
  static async deleteArticle(slug) {
    const redis = await getRedisClient();
    const article = await this.getArticle(slug);
    if (!article) return false;
    
    await redis.del(`article:${slug}`);
    await redis.srem('articles:all', slug);
    await redis.zrem('articles:published', slug);
    await redis.srem(`articles:category:${article.category}`, slug);
    
    if (article.tags) {
      const tags = JSON.parse(article.tags);
      for (const tag of tags) {
        await redis.srem(`articles:tag:${tag}`, slug);
      }
    }
    
    return true;
  }
}

// =================================================================
// ROTAS DO SITE
// =================================================================

// Homepage
app.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const category = req.query.categoria || null;
    const search = req.query.q || null;
    
    const { articles, total, totalPages } = await ArticleService.listArticles(page, 9, category, search);
    const popular = await ArticleService.getPopularArticles(5);
    
    res.render('index', {
      articles,
      popular,
      totalPages,
      currentPage: page,
      category,
      search,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Artigo individual
app.get('/artigo/:slug', async (req, res) => {
  try {
    const article = await ArticleService.getArticle(req.params.slug);
    
    if (!article || article.published === 'false') {
      return res.status(404).render('404', { siteConfig: res.locals.siteConfig });
    }
    
    const related = await ArticleService.getRelatedArticles(article.category, article.slug, 3);
    
    res.render('article', {
      article,
      related,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Categoria
app.get('/categoria/:category', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const { articles, totalPages } = await ArticleService.listArticles(page, 12, req.params.category);
    
    res.render('category', {
      articles,
      category: req.params.category,
      totalPages,
      currentPage: page,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Busca
app.get('/buscar', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.redirect('/');
    
    const { articles } = await ArticleService.listArticles(1, 50, null, q);
    
    res.render('search', {
      articles,
      query: q,
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// =================================================================
// ROTAS ADMIN
// =================================================================

// Login admin
app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { error: 'Senha incorreta' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard
app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const { articles, total } = await ArticleService.listArticles(1, 1000);
    const popular = await ArticleService.getPopularArticles(5);
    
    res.render('admin/dashboard', {
      totalArticles: total,
      popularArticles: popular,
      recentArticles: articles.slice(0, 5),
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Listar artigos
app.get('/admin/articles', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search;
    const { articles, total, totalPages } = await ArticleService.listArticles(page, 20, null, search);
    
    res.render('admin/articles', {
      articles,
      total,
      totalPages,
      currentPage: page,
      search: search || '',
      siteConfig: res.locals.siteConfig
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

// Criar artigo
app.get('/admin/articles/new', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  res.render('admin/edit', { article: null, isNew: true });
});

app.post('/admin/articles/new', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const { title, content, excerpt, coverImage, coverAlt, author, category, tags, metaTitle, metaDescription, keywords, published } = req.body;
    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];
    
    await ArticleService.createArticle({
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
    
    res.redirect('/admin/articles');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao criar artigo');
  }
});

// Editar artigo
app.get('/admin/articles/edit/:slug', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const article = await ArticleService.getArticle(req.params.slug);
    if (!article) return res.status(404).send('Artigo não encontrado');
    
    if (article.tags && typeof article.tags === 'string') {
      try {
        article.tagsArray = JSON.parse(article.tags).join(', ');
      } catch {
        article.tagsArray = article.tags;
      }
    }
    
    res.render('admin/edit', { article, isNew: false });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

app.post('/admin/articles/edit/:slug', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const { title, content, excerpt, coverImage, coverAlt, author, category, tags, metaTitle, metaDescription, keywords, published } = req.body;
    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];
    
    await ArticleService.updateArticle(req.params.slug, {
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
    
    res.redirect('/admin/articles');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao atualizar artigo');
  }
});

// Deletar artigo
app.post('/admin/articles/delete/:slug', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    await ArticleService.deleteArticle(req.params.slug);
    res.redirect('/admin/articles');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao deletar artigo');
  }
});

// Configurações
app.get('/admin/settings', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const redis = await getRedisClient();
    const config = await redis.hgetall('site:config');
    res.render('admin/settings', { config });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
});

app.post('/admin/settings', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  
  try {
    const redis = await getRedisClient();
    const { title, description, keywords, siteUrl } = req.body;
    await redis.hset('site:config', { title, description, keywords, siteUrl });
    res.redirect('/admin/settings');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao salvar configurações');
  }
});

// =================================================================
// ROTAS API
// =================================================================
app.get('/api/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const category = req.query.category;
    const search = req.query.search;
    const data = await ArticleService.listArticles(page, 12, category, search);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/articles/:slug', async (req, res) => {
  try {
    const article = await ArticleService.getArticle(req.params.slug);
    if (!article) return res.status(404).json({ error: 'Artigo não encontrado' });
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { total } = await ArticleService.listArticles(1, 1000);
    const popular = await ArticleService.getPopularArticles(5);
    res.json({ totalArticles: total, popular });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================================================================
// ROTAS DE TESTE
// =================================================================
app.get('/redis-test', async (req, res) => {
  try {
    const redis = await getRedisClient();
    await redis.set('test-key', 'Redis Cloud funcionando!');
    const value = await redis.get('test-key');
    const allKeys = await redis.keys('*');
    
    res.json({ 
      status: 'ok', 
      message: value,
      redis: 'conectado',
      totalKeys: allKeys.length,
      keys: allKeys.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// =================================================================
// EXPORT PARA VERCEL
// =================================================================
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin/login`);
    console.log(`✅ Redis Cloud conectado`);
  });
}
