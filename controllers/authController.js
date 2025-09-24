const bcrypt = require('bcrypt');
const User = require('../models/User');

/**
 * Authentication Controller
 * Handles user registration, login, logout, and profile management
 */
class AuthController {
    /**
     * Display signup page
     */
    static showSignup(req, res) {
        res.render('signup', { 
            title: 'Sign Up',
            user: res.locals.user 
        });
    }

    /**
     * Handle user registration
     */
    static async signup(req, res) {
        const { username, email, password } = req.body;
        
        try {
            // Validate input
            if (!username || !email || !password) {
                return res.render('signup', { 
                    title: 'Sign Up', 
                    error: 'All fields are required.',
                    user: res.locals.user 
                });
            }

            // Check if user already exists
            const existingUser = await User.findOne({ 
                $or: [{ username }, { email }] 
            });
            
            if (existingUser) {
                return res.render('signup', { 
                    title: 'Sign Up', 
                    error: 'Username or email already exists.',
                    user: res.locals.user
                });
            }

            // Hash password and create user
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({
                username,
                email,
                password: hashedPassword,
                wallet: 10000 // Starting wallet amount
            });

            const savedUser = await newUser.save();
            
            // Set authentication cookie
            res.cookie('user', savedUser._id, { 
                httpOnly: true, 
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
            
            res.redirect('/profile');
        } catch (error) {
            console.error('Signup error:', error);
            res.render('signup', { 
                title: 'Sign Up', 
                error: 'An error occurred during signup.',
                user: res.locals.user
            });
        }
    }

    /**
     * Display login page
     */
    static showLogin(req, res) {
        res.render('login', { 
            title: 'Login',
            user: res.locals.user 
        });
    }

    /**
     * Handle user login
     */
    static async login(req, res) {
        const { username, password } = req.body;
        
        try {
            // Validate input
            if (!username || !password) {
                return res.render('login', { 
                    title: 'Login', 
                    error: 'Username and password are required.',
                    user: res.locals.user
                });
            }

            // Find user and verify password
            const user = await User.findOne({ username });
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.render('login', { 
                    title: 'Login', 
                    error: 'Invalid username or password.',
                    user: res.locals.user
                });
            }

            // Set authentication cookie
            res.cookie('user', user._id, { 
                httpOnly: true, 
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
            
            res.redirect('/profile');
        } catch (error) {
            console.error('Login error:', error);
            res.render('login', { 
                title: 'Login', 
                error: 'An error occurred during login.',
                user: res.locals.user
            });
        }
    }

    /**
     * Handle user logout
     */
    static logout(req, res) {
        res.clearCookie('user');
        res.redirect('/');
    }

    /**
     * Display user profile
     */
    static async showProfile(req, res) {
        try {
            const user = await User.findById(req.cookies.user).lean();
            if (!user) {
                return res.redirect('/auth/login');
            }
            
            res.render('profile', {
                title: 'Your Profile',
                user: user
            });
        } catch (error) {
            console.error('Profile error:', error);
            res.status(500).render('error', {
                message: 'Error loading profile',
                error: process.env.NODE_ENV === 'development' ? error.message : null
            });
        }
    }
}

module.exports = AuthController;