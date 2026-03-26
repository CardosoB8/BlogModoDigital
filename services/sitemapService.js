const { redisClient } = require('../redis-client');
const fs = require('fs').promises;
const path = require('path');

async function generateSitemap() {
  try {
    const slugs = await redisClient.zrange('articles:published', 0, -1);
    const articles = [];
    
    for (const slug of slugs) {
      const article = await redisClient.hgetall(`article:${slug}`);
      if (article && article.published !== 'false') {
        articles.push(article);
      }
    }
    
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const now = new Date().toISOString();
    
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Homepage
    sitemap += `  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${now}</lastmod>\n    <priority>1.0</priority>\n  </url>\n`;
    
    // Artigos
    for (const article of articles) {
      sitemap += `  <url>\n    <loc>${siteUrl}/artigo/${article.slug}</loc>\n`;
      sitemap += `    <lastmod>${article.updatedAt || article.createdAt}</lastmod>\n`;
      sitemap += `    <priority>0.8</priority>\n  </url>\n`;
    }
    
    sitemap += '</urlset>';
    
    await fs.writeFile(path.join(__dirname, '../public/sitemap.xml'), sitemap);
    console.log('✅ Sitemap gerado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao gerar sitemap:', error);
  }
}

async function generateRobotsTxt() {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const robots = `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
Disallow: /admin/
Disallow: /api/`;
  
  await fs.writeFile(path.join(__dirname, '../public/robots.txt'), robots);
}

module.exports = { generateSitemap, generateRobotsTxt };