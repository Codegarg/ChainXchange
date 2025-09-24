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
const User = require('./models/User.js');
const Portfolio = require('./models/Portfolio.js');
const { isAuthenticated } = require('./middleware/auth');
const { fetchCoinGeckoDataWithCache } = require('./utils/geckoApi');

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

// Home Route
app.get('/', async (req, res) => {
    try {
        const cryptos = await fetchCoinGeckoDataWithCache(
            'https://api.coingecko.com/api/v3/coins/markets',
            {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 30,
                page: 1,
            },
            'top_30_coins',
            60
        );
        res.render('home', { 
            title: 'Cryptocurrency Market',
            cryptos,
            user: res.locals.user
        });
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        res.status(500).render('error', {
            message: 'Error loading cryptocurrency data',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Profile Route
app.get('/profile', isAuthenticated, async (req, res) => {
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
});

// Portfolio Route
app.get('/portfolio', isAuthenticated, async (req, res) => {
    try {
        const portfolioEntries = await Portfolio.find({ userId: req.cookies.user });
        const coinIds = portfolioEntries.map(entry => entry.coinId);

        let currentPrices = {};
        if (coinIds.length > 0) {
            const pricesData = await fetchCoinGeckoDataWithCache(
                'https://api.coingecko.com/api/v3/simple/price',
                {
                    ids: coinIds.join(','),
                    vs_currencies: 'usd'
                },
                'portfolio_prices',
                30
            );
            
            currentPrices = Object.keys(pricesData).reduce((acc, coinId) => {
                acc[coinId] = pricesData[coinId].usd;
                return acc;
            }, {});
        }

        const holdings = portfolioEntries.map(holding => {
            const currentPrice = currentPrices[holding.coinId] || 0;
            const value = holding.quantity * currentPrice;
            return {
                ...holding.toObject(),
                currentPrice,
                value
            };
        });

        const portfolioValue = holdings.reduce((sum, holding) => sum + holding.value, 0);

        res.render('portfolio', {
            title: 'Your Portfolio',
            holdings,
            portfolioValue
        });
    } catch (error) {
        console.error('Portfolio error:', error);
        res.status(500).render('error', {
            message: 'Error loading portfolio',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// WebSocket Setup
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Price Updates
async function sendPriceUpdates() {
    try {
        const data = await fetchCoinGeckoDataWithCache(
            'https://api.coingecko.com/api/v3/coins/markets',
            {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 30,
                page: 1,
            },
            'price_updates',
            60
        );
        if (data) {
            io.emit('priceUpdate', data);
        }
    } catch (error) {
        console.error('Error in sendPriceUpdates:', error);
    }
}

setInterval(sendPriceUpdates, 60000);

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