const async = require('async');
const axios = require('axios');
const { setTimeout: promiseTimeout } = require('timers/promises');

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
                timeout: 15000,
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

const cache = {};
async function fetchCoinGeckoDataWithCache(endpoint, params = null, cacheKey, ttlSeconds) {
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < ttlSeconds * 1000)) {
        return cache[cacheKey].data;
    }
    try {
        const data = await fetchCoinGeckoData(endpoint, params);
        if (!data) {
            throw new Error('No data received from CoinGecko');
        }
        cache[cacheKey] = {
            data: data,
            timestamp: Date.now(),
        };
        return data;
    } catch (error) {
        // Only log critical errors
        if (error.response && error.response.status >= 500) {
            console.error(`CoinGecko API Error:`, error.message);
        }
        throw error;
    }
}

module.exports = {
    fetchCoinGeckoDataWithCache: fetchCoinGeckoDataWithCache,
    fetchCoinGeckoData: fetchCoinGeckoData,
};