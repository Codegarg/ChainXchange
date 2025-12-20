const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { isAuthenticated } = require('../middleware/auth');

// Wallet page
router.get('/wallet', isAuthenticated, PaymentController.showWallet);

// Add money
router.post('/add-money', isAuthenticated, PaymentController.addMoney);

// Withdraw money (optional)
router.post('/withdraw', isAuthenticated, PaymentController.withdrawMoney);

module.exports = router;
