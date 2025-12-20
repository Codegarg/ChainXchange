const async = require('async');
const axios = require('axios');
const { setTimeout: promiseTimeout } = require('timers/promises');
const redisClient = require('./redisClient'); // Import the shared client

const geckoQueue = async.queue(async (task) => {
    console.log('Processing CoinGecko request...'); // Debug log
    let attempt = 0;
    const maxAttempts = 3;
    let lastError = null;
    let result = null;

    while (attempt < maxAttempts) {
        attempt++;
        try {
            console.log('Fetching from CoinGecko:', task.url); // Temporary debug log
            const response = await axios({
                method: 'get',
                url: task.url,
                timeout: 30000, // 30-second timeout for all requests
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'ChainXchange/1.0'
                }
            });
            
            if (!response.data || (Array.isArray(response.data) && response.data.length === 0)) {
                throw new Error('Empty response from CoinGecko');
            }
            
            result = response.data;
            console.log('CoinGecko response success'); // Temporary debug log
            break; // Exit the loop on success
        } catch (error) {
            lastError = error;
            if (error.response && error.response.status === 429) {
                const retryAfter = error.response.headers['retry-after'] || 10;
                await promiseTimeout(retryAfter * 1000);
                continue;
            } else {
                throw error; // Re-throw the error to be caught by the Promise
            }
        }
    }

    if (lastError && !result) {
        throw lastError; // Throw the last error if all attempts failed
    }

    return result; // Return the successful result
}, 1);

function fetchCoinGeckoData(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        geckoQueue.push({ url: endpoint, params: params })
            .then(resolve)
            .catch(reject);
    });
}

async function fetchCoinGeckoDataWithCache(endpoint, params = null, cacheKey, ttlSeconds) {
    try {
        // 1. Check cache using redisClient.get()
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            // console.log(`[Cache HIT] Found data for key: ${cacheKey}`);
            // Data from Redis is a string, so we must parse it
            return JSON.parse(cachedData);
        }
    } catch (cacheError) {
        console.error(`Redis GET error for key ${cacheKey}:`, cacheError.message);
        // Don't throw, just proceed to fetch
    }
    
    // 2. If not in cache, fetch data
    // console.log(`[Cache MISS] Fetching data for key: ${cacheKey}`);
    const data = await fetchCoinGeckoData(endpoint, params);
    if (!data) {
        throw new Error('No data received from CoinGecko');
    }
        
    // 3. Store in cache using redisClient.setEx() with the specific TTL
    // We stringify the data because Redis stores strings
    try {
        await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(data));
    } catch (cacheError) {
        console.error(`Redis SETEX error for key ${cacheKey}:`, cacheError.message);
        // Don't throw, just return the fetched data
    }
    
    return data;
}

module.exports = {
    fetchCoinGeckoDataWithCache: fetchCoinGeckoDataWithCache,
    fetchCoinGeckoData: fetchCoinGeckoData,
};