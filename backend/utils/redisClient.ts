import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', err => console.error('Redis Client Error', err));

(async () => {
  try {
    await client.connect();
    console.log('✅ Redis connected at startup');
  } catch (err) {
    console.error('Redis initial connection failed:', err);
  }
})();

export default client;