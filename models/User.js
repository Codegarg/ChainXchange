const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    wallet: { type: Number, default: 10000 },
    balance: { type: Number, default: 10000 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);