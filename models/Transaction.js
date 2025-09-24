const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['buy', 'sell'] },
    coinId: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalCost: { type: Number },
    sellValue: { type: Number },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);