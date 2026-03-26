const RedisService = require('../services/redisService');

class SeoMiddleware {
  async injectMetaTags(req, res, next) {
    const siteConfig = await RedisService.getSiteConfig();
    const path = req.path;
    
    // Configurações base
    res.locals.siteConfig = siteConfig;
    res.locals.currentUrl = `${siteConfig.siteUrl}${req.originalUrl}`;
    
    if (path.startsWith('/artigo/')) {
      const slug = path.split('/artigo/')[1];
      const article = await RedisService.getArticle(slug);
      
      if (article) {
        // Meta tags específicas do artigo
        res.locals.title = article.metaTitle || article.title;
        res.locals.description = article.metaDescription || article.excerpt;
        res.locals.keywords = article.keywords || siteConfig.keywords;
        res.locals.ogImage = article.coverImage;
        res.locals.ogType = 'article';
        res.locals.article = article;
        
        // JSON-LD para Schema.org
        res.locals.jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.excerpt,
          image: article.coverImage,
          datePublished: article.createdAt,
          dateModified: article.updatedAt,
          author: {
            '@type': 'Person',
            name: article.author
          },
          publisher: {
            '@type': 'Organization',
            name: siteConfig.title,
            logo: {
              '@type': 'ImageObject',
              url: `${siteConfig.siteUrl}/logo.png`
            }
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': res.locals.currentUrl
          }
        };
        
        // Breadcrumbs
        res.locals.breadcrumbs = [
          { name: 'Início', url: '/' },
          { name: article.category, url: `/categoria/${article.category.toLowerCase()}` },
          { name: article.title, url: `/artigo/${article.slug}` }
        ];
      }
    } else if (path === '/') {
      res.locals.title = siteConfig.title;
      res.locals.description = siteConfig.description;
      res.locals.keywords = siteConfig.keywords;
      res.locals.ogType = 'website';
      
      res.locals.jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteConfig.title,
        description: siteConfig.description,
        url: siteConfig.siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteConfig.siteUrl}/buscar?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      };
    } else if (path.startsWith('/categoria/')) {
      const category = path.split('/categoria/')[1];
      res.locals.title = `${category} | ${siteConfig.title}`;
      res.locals.description = `Artigos sobre ${category} - ${siteConfig.description}`;
      res.locals.ogType = 'website';
    } else {
      res.locals.title = `${siteConfig.title} | ${siteConfig.description}`;
      res.locals.description = siteConfig.description;
      res.locals.keywords = siteConfig.keywords;
      res.locals.ogType = 'website';
    }
    
    next();
  }
  
  generateMetaTags(res) {
    const meta = `
      <title>${res.locals.title || ''}</title>
      <meta name="description" content="${res.locals.description || ''}">
      <meta name="keywords" content="${res.locals.keywords || ''}">
      <meta name="robots" content="index, follow">
      <link rel="canonical" href="${res.locals.currentUrl || ''}">
      
      <!-- Open Graph -->
      <meta property="og:title" content="${res.locals.title || ''}">
      <meta property="og:description" content="${res.locals.description || ''}">
      <meta property="og:type" content="${res.locals.ogType || 'website'}">
      <meta property="og:url" content="${res.locals.currentUrl || ''}">
      <meta property="og:site_name" content="${res.locals.siteConfig?.title || ''}">
      ${res.locals.ogImage ? `<meta property="og:image" content="${res.locals.ogImage}">` : ''}
      
      <!-- Twitter Card -->
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${res.locals.title || ''}">
      <meta name="twitter:description" content="${res.locals.description || ''}">
      ${res.locals.ogImage ? `<meta name="twitter:image" content="${res.locals.ogImage}">` : ''}
    `;
    
    return meta;
  }
  
  generateJsonLd(res) {
    if (!res.locals.jsonLd) return '';
    return `<script type="application/ld+json">${JSON.stringify(res.locals.jsonLd)}</script>`;
  }
  
  generateBreadcrumbs(res) {
    if (!res.locals.breadcrumbs) return '';
    
    let html = '<nav class="flex py-3 px-5 text-gray-700 dark:text-gray-300" aria-label="Breadcrumb">';
    html += '<ol class="inline-flex items-center space-x-1 md:space-x-3 flex-wrap">';
    
    res.locals.breadcrumbs.forEach((crumb, index) => {
      const isLast = index === res.locals.breadcrumbs.length - 1;
      html += `
        <li class="inline-flex items-center">
          ${index > 0 ? '<i class="fas fa-chevron-right text-gray-400 mx-2 text-xs"></i>' : ''}
          ${!isLast ? `<a href="${crumb.url}" class="hover:text-primary transition">${crumb.name}</a>` : `<span class="text-gray-500">${crumb.name}</span>`}
        </li>
      `;
    });
    
    html += '</ol></nav>';
    return html;
  }
}

module.exports = new SeoMiddleware();