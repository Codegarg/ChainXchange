const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coinId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    averageBuyPrice: { type: Number, required: true },
    crypto: { type: String, required: true },
    image: { type: String }, // Coin image URL
    symbol: { type: String } // Coin symbol (e.g., BTC, ETH)
}, { 
    timestamps: true,
    collection: 'portfolios'
});

// Ensure compound index for userId and coinId
portfolioSchema.index({ userId: 1, coinId: 1 });

module.exports = mongoose.model('Portfolio', portfolioSchema);