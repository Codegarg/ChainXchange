const express = require('express');
const router = express.Router();
const CryptoController = require('../controllers/cryptoController');
const { isAuthenticated } = require('../middleware/auth');

// Crypto Trading Routes
router.get('/', CryptoController.showMarkets);
router.post('/buy', isAuthenticated, CryptoController.buyCrypto);
router.post('/sell', isAuthenticated, CryptoController.sellCrypto);
router.get('/chart-data/:coinId', CryptoController.getChartData);

module.exports = router;