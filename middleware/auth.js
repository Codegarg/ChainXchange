const User = require('../models/User'); // Import your User model

const isAuthenticated = async (req, res, next) => {
    try {
        if (req.cookies.user) {
            const user = await User.findById(req.cookies.user);
            if (user) {
                req.user = user; // Make the user object available in the request
                res.locals.user = user; // Make the user object available in the views
                return next(); // User is authenticated, proceed to the next middleware or route handler
            }
        }
        // If no user is found in cookies, redirect to login or send an unauthorized response
        return res.redirect('/auth/login'); // Adjust the login route as needed
    } catch (error) {
        console.error('Authentication Middleware Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

const isNotAuthenticated = (req, res, next) => {
    if (!req.cookies.user) {
        return next(); // User is not authenticated, proceed
    }
    return res.redirect('/auth/login'); // Redirect authenticated users away from login/signup pages
};

module.exports = { isAuthenticated, isNotAuthenticated };