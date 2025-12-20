const User = require('../models/User');
const PaymentTransaction = require('../models/PaymentTransaction');

class PaymentController {
    /**
     * Show payment/wallet page
     */
    static async showWallet(req, res) {
        try {
            const userId = req.cookies.user;
            const user = await User.findById(userId).lean();
            
            if (!user) {
                return res.redirect('/auth/login');
            }

            // Fetch payment transaction history
            const transactions = await PaymentTransaction.find({ userId })
                .sort({ timestamp: -1 })
                .lean();

            // Format transactions
            const formattedTransactions = transactions.map(tx => {
                const date = new Date(tx.timestamp);
                const formattedDate = date.toLocaleDateString('en-GB');
                const formattedTime = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                return {
                    ...tx,
                    formattedTimestamp: `${formattedDate} ${formattedTime}`,
                    isDeposit: tx.type === 'deposit'
                };
            });

            res.render('wallet', {
                title: 'Wallet',
                user: user,
                transactions: formattedTransactions
            });
        } catch (error) {
            console.error('Wallet page error:', error);
            res.status(500).render('error', {
                message: 'Error loading wallet',
                error: process.env.NODE_ENV === 'development' ? error.message : null
            });
        }
    }

    /**
     * Process add money
     */
    static async addMoney(req, res) {
        try {
            const userId = req.cookies.user;
            const { amount, cardNumber, cardHolder, expiryDate, cvv } = req.body;

            // Validate input
            if (!amount || !cardNumber || !cardHolder || !expiryDate || !cvv) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All fields are required' 
                });
            }

            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid amount' 
                });
            }

            // Mask card number (show only last 4 digits)
            const maskedCardNumber = '**** **** **** ' + cardNumber.slice(-4);

            // Create payment transaction record
            const paymentTx = new PaymentTransaction({
                userId,
                type: 'deposit',
                amount: amountNum,
                cardNumber: maskedCardNumber,
                cardHolder,
                status: 'completed'
            });

            await paymentTx.save();

            // Update user wallet balance
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: amountNum }
            });

            res.json({ 
                success: true, 
                message: 'Money added successfully',
                newBalance: (await User.findById(userId)).wallet
            });
        } catch (error) {
            console.error('Add money error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error processing payment' 
            });
        }
    }

    /**
     * Process withdrawal (optional feature)
     */
    static async withdrawMoney(req, res) {
        try {
            const userId = req.cookies.user;
            const { amount, cardNumber, cardHolder, expiryDate, cvv } = req.body;

            // Validate input
            if (!amount || !cardNumber || !cardHolder || !expiryDate || !cvv) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All fields are required' 
                });
            }

            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid amount' 
                });
            }

            const user = await User.findById(userId);
            
            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }

            // Check if user has sufficient balance
            if (!user.wallet || user.wallet < amountNum) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient balance. Available: $${user.wallet || 0}` 
                });
            }

            const maskedCardNumber = '**** **** **** ' + cardNumber.slice(-4);

            const paymentTx = new PaymentTransaction({
                userId,
                type: 'withdrawal',
                amount: amountNum,
                cardNumber: maskedCardNumber,
                cardHolder,
                status: 'completed'
            });

            await paymentTx.save();

            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: -amountNum }
            });

            res.json({ 
                success: true, 
                message: 'Withdrawal successful',
                newBalance: (await User.findById(userId)).wallet
            });
        } catch (error) {
            console.error('Withdrawal error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error processing withdrawal' 
            });
        }
    }
}

module.exports = PaymentController;
