const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');

// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
    if (!req.cookies.user) {
        return res.redirect('/auth/login');
    }
    try {
        const user = await User.findById(req.cookies.user);
        if (!user) {
            res.clearCookie('user');
            return res.redirect('/auth/login');
        }
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.redirect('/auth/login');
    }
};

router.get('/signup', (req, res) => {
    res.render('signup', { title: 'Sign Up' });
});

router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.render('signup', { title: 'Sign Up', error: 'Username or email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            wallet: 10000
        });

        const savedUser = await newUser.save();
        res.cookie('user', savedUser._id, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
        res.redirect('/profile');
    } catch (error) {
        console.error('Signup error:', error);
        res.render('signup', { title: 'Sign Up', error: 'An error occurred during signup.' });
    }
});

router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { title: 'Login', error: 'Invalid username or password.' });
        }

        res.cookie('user', user._id, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
        res.redirect('/profile');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { title: 'Login', error: 'An error occurred during login.' });
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('user');
    res.redirect('/');
});

router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.cookies.user).lean();
        if (!user) {
            res.clearCookie('user');
            return res.redirect('/auth/login');
        }
        res.render('profile', { title: 'Your Profile', user: user });
    } catch (error) {
        console.error('Profile error:', error);
        res.redirect('/auth/login');
    }
});

module.exports = router;