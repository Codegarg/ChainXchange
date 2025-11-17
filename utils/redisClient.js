const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// Create a single client instance
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
  // Note: The client will automatically try to reconnect.
});

// Start the connection process
// We don't await this here; the client will manage the connection state.
// Calls will be queued until the connection is ready.
redisClient.connect().catch(console.error);

console.log('Redis client initialized and connecting...');

// Export the single, connected client
module.exports = redisClient;