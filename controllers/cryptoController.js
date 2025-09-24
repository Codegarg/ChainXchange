const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const { fetchCoinGeckoDataWithCache } = require('../utils/geckoApi');

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

                // Update portfolio
                await Portfolio.findOneAndUpdate(
                    { userId, coinId },
                    {
                        $set: { 
                            averageBuyPrice: newAverageBuyPrice,
                            crypto: coinId
                        },
                        $inc: { quantity: quantityNum }
                    }
                );
            } else {
                // Create new portfolio entry
                await Portfolio.create({
                    userId,
                    coinId,
                    quantity: quantityNum,
                    averageBuyPrice: priceNum,
                    crypto: coinId
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
                    const marketData = await fetchCoinGeckoDataWithCache(
                        `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`,
                        `portfolio-prices-${coinIds}`,
                        2 * 60 * 1000 // 2 minutes cache
                    );

                    portfolioWithCurrentPrices = portfolio.map(holding => {
                        // Use market price if available, otherwise fallback to average buy price
                        const currentPrice = marketData[holding.coinId]?.usd || holding.averageBuyPrice;
                        const currentValue = holding.quantity * currentPrice;
                        const totalInvested = holding.quantity * holding.averageBuyPrice;
                        const profitLoss = currentValue - totalInvested;
                        const profitLossPercentage = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

                        return {
                            ...holding.toObject(),
                            currentPrice,
                            currentValue,
                            totalInvested,
                            profitLoss,
                            profitLossPercentage,
                            change24h: marketData[holding.coinId]?.usd_24h_change || 0
                        };
                    });

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
                    // fallback: show holdings without price info
                    portfolioWithCurrentPrices = portfolio.map(holding => ({
                        ...holding.toObject(),
                        currentPrice: 0,
                        currentValue: 0,
                        totalInvested: holding.quantity * holding.averageBuyPrice,
                        profitLoss: 0,
                        profitLossPercentage: 0,
                        change24h: 0
                    }));
                }
            }

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
     * Get chart data for cryptocurrency
     */
    static async getChartData(req, res) {
        try {
            const { coinId } = req.params;
            const days = req.query.days || '7';
            
            const chartData = await fetchCoinGeckoDataWithCache(
                `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
                `chart-${coinId}-${days}`,
                10 * 60 * 1000 // 10 minutes cache
            );

            res.json(chartData);
        } catch (error) {
            console.error('Chart data error:', error);
            res.status(500).json({ error: 'Failed to fetch chart data' });
        }
    }
}

module.exports = CryptoController;