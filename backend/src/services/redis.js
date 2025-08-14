import Redis from 'ioredis';
import config from '../config.js';

export async function setupRedis() {
  const redis = new Redis(config.redis.url);
  
  // Test connection
  try {
    await redis.ping();
    console.log('✅ Redis connected');
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    throw error;
  }
  
  return {
    client: redis,
    
    // Lock implementation
    async acquireLock(key, ttlMs = 5000) {
      const lockKey = `lock:${key}`;
      const lockId = Math.random().toString(36).substring(2);
      
      const acquired = await redis.set(
        lockKey, 
        lockId, 
        'PX', 
        ttlMs, 
        'NX'
      );
      
      if (!acquired) return null;
      
      return {
        id: lockId,
        release: async () => {
          const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            else
              return 0
            end
          `;
          await redis.eval(script, 1, lockKey, lockId);
        }
      };
    },
    
    // Pub/Sub helpers
    publish: (channel, message) => redis.publish(channel, JSON.stringify(message)),
    
    subscribe: async (channel, callback) => {
      const subscriber = new Redis(config.redis.url);
      await subscriber.subscribe(channel);
      subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          callback(JSON.parse(message));
        }
      });
      return subscriber;
    }
  };
}
