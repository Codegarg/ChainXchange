const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const { isAuthenticated } = require('../middleware/auth');
const { fetchCoinGeckoDataWithCache } = require('../utils/geckoApi');

router.post('/buy', isAuthenticated, async (req, res) => {
    try {
        // Get the data from the request
        const { coinId, quantity, price } = req.body;
        const userId = req.cookies.user;

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

            // Update portfolio with calculated values
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
});

// Get crypto listings
router.get('/', async (req, res) => {
    try {
        const cryptos = await fetchCoinGeckoDataWithCache(
            'https://api.coingecko.com/api/v3/coins/markets',
            {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 30,
                page: 1,
            },
            'crypto_listings',
            60
        );
        
        if (req.xhr || req.headers.accept && req.headers.accept.indexOf('json') > -1) {
            return res.json(cryptos);
        }
        
        res.render('crypto', {
            title: 'Cryptocurrency Market',
            coins: cryptos,
            user: res.locals.user
        });
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        res.status(500).render('error', {
            message: 'Error loading cryptocurrency data',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

router.post('/sell', isAuthenticated, async (req, res) => {
    try {
        const { coinId, quantity } = req.body;
        const userId = req.cookies.user;

        if (!coinId || !quantity) {
            throw new Error('Missing required fields');
        }

        const quantityNum = parseFloat(quantity);
        if (isNaN(quantityNum) || quantityNum <= 0) {
            throw new Error('Invalid quantity value');
        }

        // Find the portfolio entry
        const portfolio = await Portfolio.findOne({ userId, coinId });
        if (!portfolio) {
            throw new Error('Portfolio entry not found');
        }

        if (portfolio.quantity < quantityNum) {
            throw new Error('Insufficient crypto balance');
        }

        // Get current price
        const priceData = await fetchCoinGeckoDataWithCache(
            'https://api.coingecko.com/api/v3/simple/price',
            {
                ids: coinId,
                vs_currencies: 'usd'
            },
            `sell_price_${coinId}`,
            30
        );

        const currentPrice = priceData[coinId].usd;
        const sellValue = quantityNum * currentPrice;

        // Update user's wallet
        await User.findByIdAndUpdate(
            userId,
            { $inc: { wallet: sellValue } }
        );

        // Update portfolio
        if (portfolio.quantity === quantityNum) {
            // Remove the entry if selling all
            await Portfolio.deleteOne({ userId, coinId });
        } else {
            // Update quantity if selling partial
            await Portfolio.updateOne(
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
            price: currentPrice,
            sellValue,
            timestamp: new Date()
        });

        res.redirect('/portfolio');
    } catch (error) {
        console.error('Sell error:', error);
        res.status(400).render('error', {
            message: 'Sell Error',
            error: error.message
        });
    }
});
module.exports = router;