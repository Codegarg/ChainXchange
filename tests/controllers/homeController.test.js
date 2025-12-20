const request = require('supertest');
const express = require('express');
const homeController = require('../../controllers/homeController');
const geckoApi = require('../../utils/geckoApi');

// Mock the geckoApi
jest.mock('../../utils/geckoApi');

const app = express();

// Mock res.render
app.use((req, res, next) => {
  res.render = (view, options) => {
    res.send({ view, options });
  };
  next();
});

app.get('/', homeController.showHome);

describe('Home Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('showHome', () => {
    it('should render the home page with top cryptos', async () => {
      const mockCryptos = [{ id: 'bitcoin', name: 'Bitcoin' }];
      geckoApi.fetchCoinGeckoDataWithCache.mockResolvedValue(mockCryptos);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.view).toBe('home');
      expect(res.body.options.title).toBe('Home');
      expect(res.body.options.topCryptos).toEqual(mockCryptos);
    });

    it('should render the home page with fallback data if API fails', async () => {
        geckoApi.fetchCoinGeckoDataWithCache.mockResolvedValue(null);
  
        const res = await request(app).get('/');
  
        expect(res.status).toBe(200);
        expect(res.body.view).toBe('home');
        expect(res.body.options.title).toBe('Home');
        expect(res.body.options.topCryptos).toBeDefined();
        expect(res.body.options.error).toBe('Using fallback data - live prices temporarily unavailable');
      });
  });
});

