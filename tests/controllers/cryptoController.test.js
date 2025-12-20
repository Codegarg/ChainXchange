const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cryptoController = require('../../controllers/cryptoController');
const User = require('../../models/User');
const Portfolio = require('../../models/Portfolio');
const Transaction = require('../../models/Transaction');
const geckoApi = require('../../utils/geckoApi');

// Mock models and external services
jest.mock('../../models/User');
jest.mock('../../models/Portfolio');
jest.mock('../../models/Transaction');
jest.mock('../../utils/geckoApi');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: true,
}));

// Mock res.render and other response methods
app.use((req, res, next) => {
  res.render = jest.fn();
  res.redirect = jest.fn();
  res.json = jest.fn();
  res.status = jest.fn(() => res);
  res.locals.user = { _id: 'test-user-id', username: 'testuser' };
  next();
});

app.get('/crypto', cryptoController.showMarkets);
app.get('/crypto/:id', cryptoController.showCryptoDetail);
app.post('/crypto/buy', cryptoController.buyCrypto);
app.post('/crypto/sell', cryptoController.sellCrypto);

describe('Crypto Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      cookies: {},
      session: {},
    };
    res = {
      render: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn(() => res),
      locals: {},
    };
    jest.clearAllMocks();
  });

  describe('showMarkets', () => {
    it('should render the crypto markets page with data', async () => {
      const mockCoins = [{ id: 'bitcoin', name: 'Bitcoin' }];
      geckoApi.fetchCoinGeckoDataWithCache.mockResolvedValue(mockCoins);
      res.locals.user = { _id: 'test-user-id' };

      await cryptoController.showMarkets(req, res);

      expect(geckoApi.fetchCoinGeckoDataWithCache).toHaveBeenCalledWith(expect.any(String), null, 'crypto-markets', 300000);
      expect(res.render).toHaveBeenCalledWith('crypto', {
        title: 'Cryptocurrency Markets',
        coins: mockCoins,
        user: { _id: 'test-user-id' }
      });
    });
  });

  describe('showCryptoDetail', () => {
    it('should render the crypto detail page', async () => {
      const mockCoinData = { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', market_data: { current_price: { usd: 50000 } } };
      const mockChartData = { prices: [[1, 2], [3, 4]] };
      req.params.coinId = 'bitcoin';
      res.locals.user = { _id: 'test-user-id' };
      geckoApi.fetchCoinGeckoDataWithCache.mockResolvedValueOnce(mockCoinData);
      geckoApi.fetchCoinGeckoDataWithCache.mockResolvedValueOnce(mockChartData);
      Portfolio.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });


      await cryptoController.showCryptoDetail(req, res);

      expect(res.render).toHaveBeenCalledWith('crypto-detail', expect.objectContaining({
        title: 'Bitcoin (BTC)',
        coin: expect.any(Object),
      }));
    });
  });

  describe('buyCrypto', () => {
    it('should allow a user to buy crypto', async () => {
      const user = { _id: 'test-user-id', wallet: 1000 };
      User.findById.mockReturnValue({ lean: () => Promise.resolve(user) });
      const coinData = { name: 'bitcoin', symbol: 'btc', image: { large: 'url' }, market_data: { current_price: { usd: 500 } } };
      geckoApi.fetchCoinGeckoDataWithCache.mockResolvedValue(coinData);
      Portfolio.findOne.mockReturnValue({ lean: () => Promise.resolve(null) }); // Corrected mock
      Portfolio.findOneAndUpdate.mockResolvedValue(true);
      Transaction.create.mockResolvedValue(true);
      User.findByIdAndUpdate.mockResolvedValue(true);

      req.cookies.user = 'test-user-id';
      req.body = { coinId: 'bitcoin', quantity: '1', price: '500' };

      await cryptoController.buyCrypto(req, res);

      expect(User.findById).toHaveBeenCalledWith('test-user-id');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('test-user-id', { $inc: { wallet: -500 } });
      expect(Portfolio.findOneAndUpdate).toHaveBeenCalled();
      expect(Transaction.create).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/portfolio');
    });
  });

  describe('sellCrypto', () => {
    it('should allow a user to sell crypto', async () => {
      const user = { _id: 'test-user-id', wallet: 1000, save: jest.fn() };
      const portfolio = { userId: 'test-user-id', coinId: 'bitcoin', quantity: 2, save: jest.fn() };
      req.cookies.user = 'test-user-id';
      req.body = { coinId: 'bitcoin', quantity: '1', price: '500' };
      User.findById.mockResolvedValue(user);
      Portfolio.findOne.mockResolvedValue(portfolio);
      const coinData = { market_data: { current_price: { usd: 500 } } };
      geckoApi.fetchCoinGeckoDataWithCache.mockResolvedValue(coinData);
      User.findByIdAndUpdate.mockResolvedValue(true);
      Transaction.create.mockResolvedValue(true);

      await cryptoController.sellCrypto(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('test-user-id', { $inc: { wallet: 500 } });
      expect(Portfolio.findOneAndUpdate).toHaveBeenCalled();
      expect(Transaction.create).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/portfolio');
    });
  });
});

