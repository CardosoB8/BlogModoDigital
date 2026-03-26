const redis = require('redis');

let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://default:JyefUsxHJljfdvs8HACumEyLE7XNgLvG@redis-19242.c266.us-east-1-3.ec2.cloud.redislabs.com:19242',
      socket: {
        reconnectStrategy: false
      }
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('✅ Conectado ao Redis Cloud!');
  }
  return redisClient;
}

module.exports = { getRedisClient, redisClient: null };
