const { redisClient } = require('../redis-client');

async function cachePage(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const key = `page:${req.originalUrl}`;
  const cached = await redisClient.get(key);
  
  if (cached) {
    return res.send(cached);
  }
  
  const originalSend = res.send;
  res.send = function(body) {
    if (res.statusCode === 200) {
      redisClient.setex(key, 3600, body);
    }
    originalSend.call(this, body);
  };
  
  next();
}

module.exports = { cachePage };