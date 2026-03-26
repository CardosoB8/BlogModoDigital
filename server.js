require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { redisClient, connectRedis } = require('./redis-client');
const articleRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const siteRoutes = require('./routes/site');
const { generateSitemap } = require('./services/sitemapService');
const RedisStore = require('connect-redis')(session);

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

// Compressão
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições, tente novamente em 15 minutos.' }
});
app.use('/api/', limiter);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================
// CONFIGURAÇÃO DE SESSÃO COM REDIS (PERSISTENTE)
// =================================================================
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'minha_chave_super_secreta_123456789',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// =================================================================
// MIDDLEWARE PARA INJETAR CONFIGURAÇÕES DO SITE
// =================================================================
app.use(async (req, res, next) => {
    try {
        const siteConfig = await redisClient.hgetall('site:config');
        if (!siteConfig || Object.keys(siteConfig).length === 0) {
            // Configuração padrão
            const defaultConfig = {
                title: process.env.SITE_TITLE || 'ModoDigital',
                description: process.env.SITE_DESCRIPTION || 'Dicas e tutoriais para sua vida digital',
                keywords: 'blog, tecnologia, marketing, produtividade',
                siteUrl: process.env.SITE_URL || 'http://localhost:3000'
            };
            await redisClient.hset('site:config', defaultConfig);
            res.locals.siteConfig = defaultConfig;
        } else {
            res.locals.siteConfig = siteConfig;
        }
        next();
    } catch (error) {
        console.error('Erro ao carregar config do site:', error);
        res.locals.siteConfig = {
            title: 'ModoDigital',
            description: 'Dicas e tutoriais',
            siteUrl: 'http://localhost:3000'
        };
        next();
    }
});

// =================================================================
// ROTAS
// =================================================================
app.use('/api', articleRoutes);
app.use('/admin', adminRoutes);
app.use('/', siteRoutes);

// =================================================================
// GERAR SITEMAP A CADA HORA
// =================================================================
setInterval(() => {
    generateSitemap().catch(console.error);
}, 3600000);

// Gerar sitemap na inicialização
generateSitemap().catch(console.error);

// =================================================================
// ROTA DE TESTE DO REDIS
// =================================================================
app.get('/redis-test', async (req, res) => {
    try {
        await redisClient.set('test-key', 'Redis Cloud funcionando perfeitamente!');
        const value = await redisClient.get('test-key');
        const allKeys = await redisClient.keys('*');
        
        res.json({ 
            status: 'ok', 
            message: value,
            redis: 'conectado',
            totalKeys: allKeys.length,
            keys: allKeys.slice(0, 10) // Mostra apenas 10 keys
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            error: error.message 
        });
    }
});

// =================================================================
// INICIALIZAÇÃO DO SERVIDOR
// =================================================================
async function startServer() {
    try {
        // Conectar ao Redis antes de iniciar o servidor
        await connectRedis();
        
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🚀 SERVIDOR MODODIGITAL INICIADO COM SUCESSO!              ║
╠══════════════════════════════════════════════════════════════╣
║  📡 Porta: ${PORT}                                              ║
║  🗄️  Redis: CONECTADO (Cloud)                                 ║
║  🌐 Site: http://localhost:${PORT}                             ║
║  🔐 Admin: http://localhost:${PORT}/admin/login                ║
║  🔑 Senha Admin: ${process.env.ADMIN_PASSWORD || 'admin123'}    ║
║  📊 Redis Test: http://localhost:${PORT}/redis-test            ║
╚══════════════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

startServer();