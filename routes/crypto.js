const express = require('express');
const router = express.Router();
const CryptoController = require('../controllers/cryptoController');
const { isAuthenticated } = require('../middleware/auth');

// Crypto Trading Routes
router.get('/', CryptoController.showMarkets);
router.get('/detail/:coinId', CryptoController.showCryptoDetail);
router.post('/buy', isAuthenticated, CryptoController.buyCrypto);
router.post('/sell', isAuthenticated, CryptoController.sellCrypto);
router.get('/chart-data/:coinId', CryptoController.getChartData);

// User transaction history
router.get('/history', isAuthenticated, CryptoController.showHistory);

// Debug route for testing chart data
router.get('/test-chart/:coinId', (req, res) => {
    const { coinId } = req.params;
    const days = req.query.days || '7';
    
    // Generate test data immediately
    const basePrice = coinId === 'bitcoin' ? 65000 : coinId === 'ethereum' ? 3500 : 100;
    const dataPoints = days === '1' ? 24 : days === '7' ? 7 : 30;
    const interval = days === '1' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    const prices = Array.from({ length: dataPoints }, (_, i) => {
        const timestamp = Date.now() - (dataPoints - 1 - i) * interval;
        const price = basePrice * (1 + (Math.random() - 0.5) * 0.1);
        return [timestamp, price];
    });
    
    res.json({ prices, debug: true, coinId, days });
});

module.exports = router;