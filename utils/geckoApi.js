const async = require('async');
const axios = require('axios');
const { setTimeout: promiseTimeout } = require('timers/promises');

const geckoQueue = async.queue(async (task) => {
    let attempt = 0;
    const maxAttempts = 3;
    let lastError = null;
    let result = null;

    while (attempt < maxAttempts) {
        attempt++;
        try {
            console.log(`Gecko API: Attempt ${attempt} to ${task.url} with params:`, task.params);
            const response = await axios.get(task.url, {
                params: task.params,
                timeout: 10000,
            });
            console.log(`Gecko API: Success on attempt ${attempt}`);
            result = response.data;
            break; // Exit the loop on success
        } catch (error) {
            lastError = error;
            console.error(`Gecko API: Attempt ${attempt} - Error:`, error.message);
            if (error.response && error.response.status === 429) {
                const retryAfter = error.response.headers['retry-after'] || 10;
                console.warn(`Gecko API Rate Limit: Retrying after ${retryAfter} seconds for ${task.url}`);
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
async function fetchCoinGeckoDataWithCache(endpoint, params, cacheKey, ttlSeconds) {
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < ttlSeconds * 1000)) {
        console.log(`Serving ${cacheKey} from cache`);
        return cache[cacheKey].data;
    }
    try {
        const data = await fetchCoinGeckoData(endpoint, params);
        console.log(`Fetched and caching ${cacheKey}:`, data);
        cache[cacheKey] = {
            data: data,
            timestamp: Date.now(),
        };
        return data;
    } catch (error) {
        console.error(`Error fetching ${cacheKey}:`, error);
        throw error;
    }
}

module.exports = {
    fetchCoinGeckoDataWithCache: fetchCoinGeckoDataWithCache,
    fetchCoinGeckoData: fetchCoinGeckoData,
};