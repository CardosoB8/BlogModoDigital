const { redisClient } = require('../redis-client');
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');

class RedisService {
  
  // =============================================================
  // ARTIGOS CRUD
  // =============================================================
  
  async createArticle(articleData) {
    const id = uuidv4();
    const slug = this.generateSlug(articleData.title);
    const now = new Date().toISOString();
    
    const article = {
      id,
      slug,
      ...articleData,
      createdAt: now,
      updatedAt: now,
      views: '0',
      published: articleData.published !== false ? 'true' : 'false'
    };
    
    // Salvar no Redis como hash
    await redisClient.hset(`article:${slug}`, article);
    
    // Índices
    await redisClient.sadd('articles:all', slug);
    if (article.published === 'true') {
      await redisClient.zadd('articles:published', Date.now(), slug);
      await redisClient.sadd(`articles:category:${article.category}`, slug);
      if (article.tags && article.tags.length) {
        for (const tag of article.tags) {
          await redisClient.sadd(`articles:tag:${tag}`, slug);
        }
      }
    }
    
    return article;
  }
  
  async getArticle(slug) {
    try {
      const article = await redisClient.hgetall(`article:${slug}`);
      if (!article || Object.keys(article).length === 0) return null;
      
      // Incrementar views
      const views = parseInt(article.views || '0') + 1;
      await redisClient.hset(`article:${slug}`, 'views', views.toString());
      await redisClient.zincrby('articles:views', 1, slug);
      
      return article;
    } catch (error) {
      console.error('Erro ao buscar artigo:', error);
      return null;
    }
  }
  
  async updateArticle(slug, updates) {
    const oldArticle = await this.getArticle(slug);
    if (!oldArticle) return null;
    
    let newSlug = slug;
    if (updates.title && updates.title !== oldArticle.title) {
      newSlug = this.generateSlug(updates.title);
      
      // Copiar dados para novo slug
      const oldData = await redisClient.hgetall(`article:${slug}`);
      await redisClient.hset(`article:${newSlug}`, oldData);
      await redisClient.del(`article:${slug}`);
      
      // Atualizar índices
      await redisClient.srem('articles:all', slug);
      await redisClient.sadd('articles:all', newSlug);
      if (oldArticle.published === 'true') {
        await redisClient.zrem('articles:published', slug);
        await redisClient.zadd('articles:published', Date.now(), newSlug);
      }
    }
    
    updates.updatedAt = new Date().toISOString();
    await redisClient.hset(`article:${newSlug}`, updates);
    
    return this.getArticle(newSlug);
  }
  
  async deleteArticle(slug) {
    const article = await this.getArticle(slug);
    if (!article) return false;
    
    await redisClient.del(`article:${slug}`);
    await redisClient.srem('articles:all', slug);
    await redisClient.zrem('articles:published', slug);
    await redisClient.srem(`articles:category:${article.category}`, slug);
    
    if (article.tags) {
      const tags = typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags;
      for (const tag of tags) {
        await redisClient.srem(`articles:tag:${tag}`, slug);
      }
    }
    
    return true;
  }
  
  async listArticles(page = 1, limit = 10, category = null, search = null) {
    try {
      let slugs = [];
      
      if (category && category !== 'all' && category !== 'null') {
        slugs = await redisClient.smembers(`articles:category:${category}`);
      } else {
        slugs = await redisClient.zrevrange('articles:published', 0, -1);
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
      const end = start + limit;
      const paginatedSlugs = slugs.slice(start, end);
      
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
    } catch (error) {
      console.error('Erro ao listar artigos:', error);
      return { articles: [], total: 0, page: 1, totalPages: 0 };
    }
  }
  
  async getPopularArticles(limit = 5) {
    try {
      const slugs = await redisClient.zrevrange('articles:views', 0, limit - 1);
      const articles = [];
      for (const slug of slugs) {
        const article = await this.getArticle(slug);
        if (article) articles.push(article);
      }
      return articles;
    } catch (error) {
      console.error('Erro ao buscar populares:', error);
      return [];
    }
  }
  
  async getRelatedArticles(category, currentSlug, limit = 3) {
    try {
      const slugs = await redisClient.smembers(`articles:category:${category}`);
      const filtered = slugs.filter(slug => slug !== currentSlug).slice(0, limit);
      const articles = [];
      for (const slug of filtered) {
        const article = await this.getArticle(slug);
        if (article && article.published === 'true') articles.push(article);
      }
      return articles;
    } catch (error) {
      console.error('Erro ao buscar relacionados:', error);
      return [];
    }
  }
  
  async getCategories() {
    try {
      const keys = await redisClient.keys('articles:category:*');
      const categories = [];
      for (const key of keys) {
        const cat = key.replace('articles:category:', '');
        const count = await redisClient.scard(key);
        categories.push({ name: cat, count });
      }
      return categories;
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      return [];
    }
  }
  
  generateSlug(title) {
    return slugify(title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  
  // =============================================================
  // CONFIGURAÇÕES DO SITE
  // =============================================================
  
  async getSiteConfig() {
    try {
      let config = await redisClient.hgetall('site:config');
      if (!config || Object.keys(config).length === 0) {
        config = {
          title: process.env.SITE_TITLE || 'ModoDigital',
          description: process.env.SITE_DESCRIPTION || 'Dicas e tutoriais para sua vida digital',
          keywords: 'blog, tecnologia, marketing, produtividade',
          siteUrl: process.env.SITE_URL || 'http://localhost:3000'
        };
        await this.saveSiteConfig(config);
      }
      return config;
    } catch (error) {
      console.error('Erro ao buscar config do site:', error);
      return {
        title: 'ModoDigital',
        description: 'Dicas e tutoriais',
        siteUrl: 'http://localhost:3000'
      };
    }
  }
  
  async saveSiteConfig(config) {
    try {
      await redisClient.hset('site:config', config);
      return config;
    } catch (error) {
      console.error('Erro ao salvar config do site:', error);
      return null;
    }
  }
  
  // =============================================================
  // UTILITÁRIOS
  // =============================================================
  
  async clearAllArticles() {
    try {
      const keys = await redisClient.keys('article:*');
      for (const key of keys) {
        await redisClient.del(key);
      }
      await redisClient.del('articles:all');
      await redisClient.del('articles:published');
      await redisClient.del('articles:views');
      
      const categoryKeys = await redisClient.keys('articles:category:*');
      for (const key of categoryKeys) {
        await redisClient.del(key);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao limpar artigos:', error);
      return false;
    }
  }
  
  async getStats() {
    try {
      const totalKeys = await redisClient.dbsize();
      const articlesCount = await redisClient.scard('articles:all');
      const publishedCount = await redisClient.zcard('articles:published');
      
      return {
        totalKeys,
        articlesCount,
        publishedCount,
        redisStatus: 'connected'
      };
    } catch (error) {
      console.error('Erro ao obter stats:', error);
      return { error: error.message };
    }
  }
}

module.exports = new RedisService();