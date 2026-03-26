const redis = require('redis');

// Configuração do Redis com suas credenciais
const redisClient = redis.createClient({
    url: 'redis://default:JyefUsxHJljfdvs8HACumEyLE7XNgLvG@redis-19242.c266.us-east-1-3.ec2.cloud.redislabs.com:19242'
});

redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('✅ Conectado ao Redis Cloud!');
});

redisClient.on('ready', () => {
    console.log('🚀 Redis está pronto para uso');
});

// Função para conectar (async/await)
async function connectRedis() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
    return redisClient;
}

// Exportar cliente e função de conexão
module.exports = { 
    redisClient,
    connectRedis 
};