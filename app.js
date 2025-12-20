const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');
const MongoStore = require('connect-mongo');

const authRoutes = require('./routes/auth.js');
const cryptoRoutes = require('./routes/crypto.js');
const paymentRoutes = require('./routes/payment.js');
const User = require('./models/User.js');
const { isAuthenticated } = require('./middleware/auth');
const HomeController = require('./controllers/homeController');
const CryptoController = require('./controllers/cryptoController');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Handlebars Setup
const hbs = expressHandlebars.create({
    extname: 'hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials'),
    helpers: {
        formatNumber: function (num) {
            if (!num) return '0';
            if (num >= 1000000) {
                return (num / 1000000).toFixed(2) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(2) + 'K';
            }
            return num.toString();
        },
        formatLargeNumber: function (num) {
            if (!num) return 'N/A';
            return num.toLocaleString();
        },
        formatPrice: function (price) {
            if (price == null || price === undefined) {
                return 'N/A';
            }
            if (price < 0.01) {
                return price.toPrecision(2);
            } else if (price < 1) {
                return price.toFixed(4);
            } else if (price < 10) {
                return price.toFixed(2);
            } else {
                return price.toFixed(2);
            }
        },
        getFullYear: function() {
            return new Date().getFullYear();
        },
        gt: function(a, b) {
            return a > b;
        },
        lt: function(a, b) {
            return a < b;
        },
        eq: function(a, b) {
            return a === b;
        },
        multiply: function(a, b) {
            return a * b;
        },
        divide: function(a, b) {
            return b !== 0 ? a / b : 0;
        },
        subtract: function(a, b) {
            return a - b;
        },
        add: function(a, b) {
            return a + b;
        },
        calculateRangePosition: function(min, current, max) {
            if (!min || !current || !max || max === min) return 50;
            const position = ((current - min) / (max - min)) * 100;
            return Math.max(0, Math.min(100, position)).toFixed(2);
        },
        json: function(context) {
            return JSON.stringify(context);
        }
    }
});

// Middleware Setup
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-secret-key'));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crypto-trading', {
    retryWrites: true,
    w: 'majority'
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crypto-trading',
        ttl: 24 * 60 * 60
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// User Authentication Middleware
app.use(async (req, res, next) => {
    if (req.cookies.user) {
        try {
            const user = await User.findById(req.cookies.user).lean();
            res.locals.user = user;
        } catch (error) {
            console.error('Error fetching user:', error);
            res.locals.user = null;
            res.clearCookie('user');
        }
    } else {
        res.locals.user = null;
    }
    next();
});

// Routes

app.use('/auth', authRoutes);
app.use('/crypto', cryptoRoutes);
app.use('/payment', paymentRoutes);

// Main Application Routes
app.get('/', HomeController.showHome);
app.get('/portfolio', isAuthenticated, CryptoController.showPortfolio);
app.get('/profile', isAuthenticated, require('./controllers/authController').showProfile);

// WebSocket Setup for real-time updates
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Error Handling
app.use((req, res, next) => {
    res.status(404).render('error', {
        message: 'Page Not Found',
        error: process.env.NODE_ENV === 'development' ? 'The requested page does not exist.' : null
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : null
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

module.exports = app;