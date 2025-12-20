const mongoose = require('mongoose');
const Portfolio = require('../../models/Portfolio');
const User = require('../../models/User');

describe('Portfolio Model', () => {
  let user;

  beforeAll(async () => {
    user = new User({
      username: 'portfoliouser',
      email: 'portfolio@test.com',
      password: 'password',
    });
    await user.save();
  });

  it('should create a new portfolio entry', async () => {
    const portfolioData = {
      userId: user._id,
      coinId: 'bitcoin',
      quantity: 1.5,
      averageBuyPrice: 50000,
      crypto: 'Bitcoin',
      image: 'some-url',
      symbol: 'BTC',
    };
    const portfolio = new Portfolio(portfolioData);
    await portfolio.save();

    const foundPortfolio = await Portfolio.findOne({ userId: user._id, coinId: 'bitcoin' });
    expect(foundPortfolio).toBeDefined();
    expect(foundPortfolio.quantity).toBe(1.5);
  });

  it('should not create a portfolio entry without required fields', () => {
    const portfolio = new Portfolio({ userId: user._id, coinId: 'test' });
    const err = portfolio.validateSync();
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.averageBuyPrice).toBeDefined();
    expect(err.errors.crypto).toBeDefined();
  });
});

