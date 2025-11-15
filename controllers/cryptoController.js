const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const { fetchCoinGeckoDataWithCache } = require('../utils/geckoApi');
const NodeCache = require('node-cache');

// Cache for portfolio data. TTL of 120 seconds (2 minutes)
const portfolioCache = new NodeCache({ stdTTL: 120 });

/**
 * Helper function to get base price for common cryptocurrencies
 */
function getBasePriceForCoin(coinId) {
    const basePrices = {
        'bitcoin': 65000,
        'ethereum': 3500,
        'binancecoin': 600,
        'ripple': 0.6,
        'cardano': 0.5,
        'solana': 150,
        'dogecoin': 0.1,
        'matic-network': 1.2,
        'avalanche-2': 35,
        'chainlink': 12,
        'litecoin': 85,
        'bitcoin-cash': 140,
        'stellar': 0.12,
        'vechain': 0.03,
        'filecoin': 6,
        'tron': 0.08,
        'ethereum-classic': 22,
        'monero': 160,
        'algorand': 0.2,
        'cosmos': 8
    };
    
    return basePrices[coinId] || 100; // Default to $100 if coin not found
}

/**
 * Generate mock chart data for fallback
 */
function generateMockChartData(basePrice, days) {
    const dayCount = parseInt(days);
    let dataPoints = 24; // Default hourly for 1 day
    let interval = 60 * 60 * 1000; // 1 hour
    
    if (dayCount <= 1) {
        dataPoints = 24; // Hourly
        interval = 60 * 60 * 1000;
    } else if (dayCount <= 7) {
        dataPoints = dayCount * 4; // 6-hour intervals
        interval = 6 * 60 * 60 * 1000;
    } else if (dayCount <= 30) {
        dataPoints = dayCount; // Daily
        interval = 24 * 60 * 60 * 1000;
    } else {
        dataPoints = Math.min(dayCount, 365); // Daily up to a year
        interval = 24 * 60 * 60 * 1000;
    }
    
    const prices = [];
    const now = Date.now();
    let currentPrice = basePrice;
    
    for (let i = 0; i < dataPoints; i++) {
        const timestamp = now - (dataPoints - 1 - i) * interval;
        
        // Add some realistic price movement (±5% maximum change per interval)
        const changePercent = (Math.random() - 0.5) * 0.1; // ±5%
        currentPrice *= (1 + changePercent);
        
        // Ensure price doesn't go below 10% of base price
        currentPrice = Math.max(currentPrice, basePrice * 0.1);
        
        prices.push([timestamp, parseFloat(currentPrice.toFixed(8))]);
    }
    
    return { prices };
}

/**
 * Cryptocurrency Controller
 * Handles crypto trading, portfolio management, and market data
 */
class CryptoController {
    /**
     * Display cryptocurrency markets
     */
    static async showMarkets(req, res) {
        try {
            console.log('Fetching market data...'); // Debug log
            const coins = await Promise.race([
                fetchCoinGeckoDataWithCache(
                    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&locale=en',
                    null,
                    'crypto-markets',
                    5 * 60 * 1000
                ),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout')), 10000)
                )
            ]);

            // If no coins received, use fallback data
            if (!coins || coins.length === 0) {
                console.error('No coins received from CoinGecko, using fallback data');
                // Fallback data for testing
                const fallbackCoins = [
                    {
                        id: "bitcoin",
                        symbol: "btc",
                        name: "Bitcoin",
                        current_price: 45000,
                    },
                    {
                        id: "ethereum",
                        symbol: "eth",
                        name: "Ethereum",
                        current_price: 3000,
                    }
                ];
                
                return res.render('crypto', {
                    title: 'Cryptocurrency Markets',
                    coins: fallbackCoins,
                    user: res.locals.user
                });
            }

            res.render('crypto', {
                title: 'Cryptocurrency Markets',
                coins,
                user: res.locals.user
            });
        } catch (error) {
            console.error('Markets error:', error);
            // Render with fallback data instead of error page
            const fallbackCoins = [
                {
                    id: "bitcoin",
                    symbol: "btc",
                    name: "Bitcoin",
                    current_price: 45000,
                },
                {
                    id: "ethereum",
                    symbol: "eth",
                    name: "Ethereum",
                    current_price: 3000,
                }
            ];
            
            res.render('crypto', {
                title: 'Cryptocurrency Markets',
                coins: fallbackCoins,
                user: res.locals.user,
                error: 'Using fallback data - live prices temporarily unavailable'
            });
        }
    }

    /**
     * Handle cryptocurrency purchase
     */
    static async buyCrypto(req, res) {
        try {
            const { coinId, quantity, price } = req.body;
            const userId = req.cookies.user;

            // Validate input
            if (!coinId || !quantity || !price) {
                throw new Error('Missing required fields');
            }

            const quantityNum = parseFloat(quantity);
            const priceNum = parseFloat(price);
            const totalCost = quantityNum * priceNum;

            if (isNaN(quantityNum) || quantityNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
                throw new Error('Invalid quantity or price values');
            }

            // Find user and check wallet balance
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            if (user.wallet < totalCost) {
                throw new Error('Insufficient funds');
            }

            // Fetch coin data to get image and symbol
            let coinData = null;
            try {
                const coinInfo = await fetchCoinGeckoDataWithCache(
                    `https://api.coingecko.com/api/v3/coins/${coinId}`,
                    null,
                    `coin-info-${coinId}`,
                    60 * 60 * 1000 // 1 hour cache
                );
                coinData = {
                    name: coinInfo.name,
                    symbol: coinInfo.symbol?.toUpperCase(),
                    image: coinInfo.image?.large || coinInfo.image?.small || '/images/default-coin.svg'
                };
            } catch (error) {
                console.error('Failed to fetch coin data:', error);
                // Use fallback data
                coinData = {
                    name: coinId.charAt(0).toUpperCase() + coinId.slice(1),
                    symbol: coinId.toUpperCase().substring(0, 4),
                    image: '/images/default-coin.svg'
                };
            }

            // Update user wallet
            await User.findByIdAndUpdate(
                userId,
                { $inc: { wallet: -totalCost } }
            );

            // Find existing portfolio
            const existingPortfolio = await Portfolio.findOne({ userId, coinId });
            
            if (existingPortfolio) {
                // Calculate new average price
                const newTotalQuantity = existingPortfolio.quantity + quantityNum;
                const newAverageBuyPrice = (
                    (existingPortfolio.quantity * existingPortfolio.averageBuyPrice) + totalCost
                ) / newTotalQuantity;

                // Update portfolio with coin data
                await Portfolio.findOneAndUpdate(
                    { userId, coinId },
                    {
                        $set: { 
                            averageBuyPrice: newAverageBuyPrice,
                            crypto: coinData.name,
                            image: coinData.image,
                            symbol: coinData.symbol
                        },
                        $inc: { quantity: quantityNum }
                    }
                );
            } else {
                // Create new portfolio entry with coin data
                await Portfolio.create({
                    userId,
                    coinId,
                    quantity: quantityNum,
                    averageBuyPrice: priceNum,
                    crypto: coinData.name,
                    image: coinData.image,
                    symbol: coinData.symbol
                });
            }

            // Create transaction record
            await Transaction.create({
                userId,
                type: 'buy',
                coinId,
                quantity: quantityNum,
                price: priceNum,
                totalCost,
                timestamp: new Date()
            });

            // --- CACHE INVALIDATION ---
            // Clear the cached portfolio data for this user
            portfolioCache.del(`portfolio:${userId}`);
            // --- END CACHE INVALIDATION ---

            res.redirect('/portfolio');
        } catch (error) {
            console.error('Buy error:', error);
            res.status(400).render('error', {
                message: 'Purchase Error',
                error: error.message
            });
        }
    }

    /**
     * Handle cryptocurrency sale
     */
    static async sellCrypto(req, res) {
        try {
            const { coinId, quantity, price } = req.body;
            const userId = req.cookies.user;

            // Validate input
            if (!coinId || !quantity || !price) {
                throw new Error('Missing required fields');
            }

            const quantityNum = parseFloat(quantity);
            const priceNum = parseFloat(price);
            const totalEarnings = quantityNum * priceNum;

            if (isNaN(quantityNum) || quantityNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
                throw new Error('Invalid quantity or price values');
            }

            // Find existing portfolio
            const existingPortfolio = await Portfolio.findOne({ userId, coinId });
            if (!existingPortfolio || existingPortfolio.quantity < quantityNum) {
                throw new Error('Insufficient cryptocurrency holdings');
            }

            // Update user wallet
            await User.findByIdAndUpdate(
                userId,
                { $inc: { wallet: totalEarnings } }
            );

            // Update or remove portfolio entry
            const remainingQuantity = existingPortfolio.quantity - quantityNum;
            if (remainingQuantity <= 0) {
                await Portfolio.deleteOne({ userId, coinId });
            } else {
                await Portfolio.findOneAndUpdate(
                    { userId, coinId },
                    { $inc: { quantity: -quantityNum } }
                );
            }

            // Create transaction record
            await Transaction.create({
                userId,
                type: 'sell',
                coinId,
                quantity: quantityNum,
                price: priceNum,
                totalCost: totalEarnings,
                timestamp: new Date()
            });

            // Wait a moment for the database to update
            await new Promise(resolve => setTimeout(resolve, 500));

            // --- CACHE INVALIDATION ---
            // Clear the cached portfolio data for this user
            portfolioCache.del(`portfolio:${userId}`);
            // --- END CACHE INVALIDATION ---

            // Redirect with success message
            req.session.message = {
                type: 'success',
                text: `Successfully sold ${quantityNum} ${coinId}`
            };
            return res.redirect('/portfolio');
        } catch (error) {
            console.error('Sell error:', error);
            // Return to portfolio with error message
            req.session.message = {
                type: 'error',
                text: error.message
            };
            return res.redirect('/portfolio');
        }
    }

    /**
     * Display user portfolio
     */
    static async showPortfolio(req, res) {
        try {
            const userId = req.cookies.user;
            
            // --- PORTFOLIO CACHE CHECK ---
            const cacheKey = `portfolio:${userId}`;
            const cachedData = portfolioCache.get(cacheKey);
            
            if (cachedData) {
                // console.log(`[Cache HIT] Using cached portfolio for ${userId}`); // Optional debug log
                return res.render('portfolio', {
                    title: 'Portfolio',
                    user: cachedData.user,
                    holdings: cachedData.holdings,
                    portfolioValue: cachedData.portfolioValue,
                    totalProfitLoss: cachedData.totalProfitLoss,
                    totalProfitLossPercentage: cachedData.totalProfitLossPercentage
                });
            }
            // --- END CACHE CHECK ---
            
            // console.log(`[Cache MISS] Fetching portfolio for ${userId}`); // Optional debug log
            const user = await User.findById(userId);
            const portfolio = await Portfolio.find({ userId });

            if (!user) {
                return res.redirect('/auth/login');
            }

            // Get current market data for portfolio coins
            let portfolioWithCurrentPrices = [];
            let totalPortfolioValue = 0;
            let totalInvested = 0;
            let totalProfitLoss = 0;
            let totalProfitLossPercentage = 0;

            if (portfolio.length > 0) {
                try {
                    const coinIds = portfolio.map(p => p.coinId).join(',');
                    
                    // Fetch both price and coin data
                    const [marketData, coinsData] = await Promise.all([
                        fetchCoinGeckoDataWithCache(
                            `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`,
                            null,
                            `portfolio-prices-${coinIds}`,
                            2 * 60 * 1000 // 2 minutes cache
                        ),
                        fetchCoinGeckoDataWithCache(
                            `https://api.coingecko.com/api/v3/coins/markets?ids=${coinIds}&vs_currency=usd&order=market_cap_desc&per_page=250&page=1`,
                            null,
                            `portfolio-coins-${coinIds}`,
                            10 * 60 * 1000 // 10 minutes cache
                        )
                    ]);

                    portfolioWithCurrentPrices = await Promise.all(portfolio.map(async (holding) => {
                        // Use market price if available, otherwise fallback to average buy price
                        const currentPrice = marketData[holding.coinId]?.usd || holding.averageBuyPrice;
                        const currentValue = holding.quantity * currentPrice;
                        const totalInvested = holding.quantity * holding.averageBuyPrice;
                        const profitLoss = currentValue - totalInvested;
                        const profitLossPercentage = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

                        // Get coin image and symbol from market data
                        const coinMarketData = coinsData?.find(coin => coin.id === holding.coinId);
                        let image = holding.image;
                        let symbol = holding.symbol;
                        let crypto = holding.crypto;

                        // Update missing data from market API
                        if (!image || !symbol) {
                            if (coinMarketData) {
                                image = coinMarketData.image;
                                symbol = coinMarketData.symbol?.toUpperCase();
                                crypto = coinMarketData.name;

                                // Update the portfolio entry in database if missing data
                                if (!holding.image || !holding.symbol) {
                                    try {
                                        await Portfolio.findOneAndUpdate(
                                            { _id: holding._id },
                                            {
                                                $set: {
                                                    image: image,
                                                    symbol: symbol,
                                                    crypto: crypto
                                                }
                                            }
                                        );
                                    } catch (updateError) {
                                        console.error('Error updating portfolio image:', updateError);
                                    }
                                }
                            } else {
                                // Fallback values
                                image = image || '/images/default-coin.svg';
                                symbol = symbol || holding.coinId.toUpperCase();
                                crypto = crypto || holding.coinId.charAt(0).toUpperCase() + holding.coinId.slice(1);
                            }
                        }

                        return {
                            ...holding.toObject(),
                            currentPrice,
                            currentValue,
                            totalInvested,
                            profitLoss,
                            profitLossPercentage,
                            change24h: marketData[holding.coinId]?.usd_24h_change || 0,
                            image: image,
                            symbol: symbol,
                            crypto: crypto
                        };
                    }));

                    totalPortfolioValue = portfolioWithCurrentPrices.reduce(
                        (sum, holding) => sum + holding.currentValue, 0
                    );
                    totalInvested = portfolioWithCurrentPrices.reduce(
                        (sum, holding) => sum + holding.totalInvested, 0
                    );
                    totalProfitLoss = totalPortfolioValue - totalInvested;
                    totalProfitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;
                } catch (err) {
                    console.error('Portfolio CoinGecko error:', err);
                    // fallback: show holdings without updated price info but with existing image data
                    portfolioWithCurrentPrices = portfolio.map(holding => ({
                        ...holding.toObject(),
                        currentPrice: holding.averageBuyPrice,
                        currentValue: holding.quantity * holding.averageBuyPrice,
                        totalInvested: holding.quantity * holding.averageBuyPrice,
                        profitLoss: 0,
                        profitLossPercentage: 0,
                        change24h: 0,
                        image: holding.image || '/images/default-coin.svg',
                        symbol: holding.symbol || holding.coinId.toUpperCase(),
                        crypto: holding.crypto || holding.coinId.charAt(0).toUpperCase() + holding.coinId.slice(1)
                    }));
                }
            }
            
            // --- STORE DATA IN CACHE ---
            const dataToCache = {
                user: user.toObject(), // Store a plain object, not a Mongoose doc
                holdings: portfolioWithCurrentPrices,
                portfolioValue: totalPortfolioValue,
                totalProfitLoss,
                totalProfitLossPercentage
            };
            portfolioCache.set(cacheKey, dataToCache);
            // --- END STORE DATA ---

            res.render('portfolio', {
                title: 'Portfolio',
                user,
                holdings: portfolioWithCurrentPrices,
                portfolioValue: totalPortfolioValue,
                totalProfitLoss,
                totalProfitLossPercentage
            });
        } catch (error) {
            console.error('Portfolio error:', error);
            res.status(500).render('error', {
                message: 'Error loading portfolio',
                error: process.env.NODE_ENV === 'development' ? error.message : null
            });
        }
    }

    /**
     * Display user's transaction history
     */
    static async showHistory(req, res) {
        try {
            const userId = req.cookies.user;
            const user = await User.findById(userId).lean();

            if (!user) {
                return res.redirect('/auth/login');
            }
            
            // --- New Sorting/Filtering Logic ---
            const { type, sortBy, order } = req.query;

            // 1. Create Filter Query
            const findQuery = { userId };
            if (type && (type === 'buy' || type === 'sell')) {
                findQuery.type = type;
            }

            // 2. Create Sort Query
            const sortQuery = {};
            const sortOrderVal = order === 'asc' ? 1 : -1; // Default to descending
            const sortByVal = sortBy || 'timestamp'; // Default to timestamp
            
            // Whitelist sortable fields
            if (['timestamp', 'type', 'price', 'quantity', 'totalCost'].includes(sortByVal)) {
                 sortQuery[sortByVal] = sortOrderVal;
            } else {
                 sortQuery['timestamp'] = -1; // Default fallback
            }
            // --- End New Logic ---

            // Fetch transactions for the user, applying filters and sorting
            const transactions = await Transaction.find(findQuery)
                .sort(sortQuery)
                .lean();

            // Format transactions for easier display in the view
            const formattedTransactions = transactions.map(tx => {
                const date = new Date(tx.timestamp);
                // Format as DD/MM/YYYY
                const formattedDate = date.toLocaleDateString('en-GB');
                // Format as 02:45 PM
                const formattedTime = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                return {
                    ...tx,
                    coinName: tx.coinId.charAt(0).toUpperCase() + tx.coinId.slice(1),
                    totalValue: tx.totalCost || tx.sellValue || (tx.quantity * tx.price),
                    isBuy: tx.type === 'buy',
                    // Add the pre-formatted timestamp string
                    formattedTimestamp: `${formattedDate} ${formattedTime}`
                };
            });

            res.render('history', {
                title: 'Order History',
                user,
                transactions: formattedTransactions,
                // Pass current options to view for dropdowns
                currentOptions: {
                    type: type || 'all',
                    sortBy: sortByVal,
                    order: order || 'desc'
                }
            });
        } catch (error) {
            console.error('History error:', error);
            res.status(500).render('error', {
                message: 'Error loading transaction history',
                error: process.env.NODE_ENV === 'development' ? error.message : null
            });
        }
    }

    /**
     * Get chart data for cryptocurrency
     */
    static async getChartData(req, res) {
        try {
            const { coinId } = req.params;
            const days = req.query.days || '7';
            
            // Set a shorter timeout for chart requests
            const chartDataPromise = fetchCoinGeckoDataWithCache(
                `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
                null,
                `chart-${coinId}-${days}`,
                5 * 60 * 1000 // 5 minutes cache
            );
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Chart request timeout')), 10000) // 10 second timeout
            );
            
            const chartData = await Promise.race([chartDataPromise, timeoutPromise]);
            
            // Validate data structure
            if (!chartData || !chartData.prices || !Array.isArray(chartData.prices)) {
                throw new Error('Invalid chart data structure');
            }
            
            res.json(chartData);
        } catch (error) {
            console.error('Chart data error:', error);
            
            // Generate realistic fallback data based on coinId and days
            const basePrice = getBasePriceForCoin(req.params.coinId);
            const mockData = generateMockChartData(basePrice, req.query.days || '7');
            
            res.json(mockData);
        }
    }
}

module.exports = CryptoController;