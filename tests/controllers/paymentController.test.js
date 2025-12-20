const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const paymentController = require('../../controllers/paymentController');
const User = require('../../models/User');
const PaymentTransaction = require('../../models/PaymentTransaction');

// Mock models
jest.mock('..\/..\/...\/..\/models/User');
jest.mock('..\/..\/...\/..\/models/PaymentTransaction');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
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
  next();
});

app.get('/wallet', paymentController.showWallet);
app.post('/wallet/add', paymentController.addMoney);
app.post('/wallet/withdraw', paymentController.withdrawMoney);

describe('Payment Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      cookies: {},
      body: {},
    };
    res = {
      render: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => res),
    };
    jest.clearAllMocks();
  });

  describe('showWallet', () => {
    it('should render the wallet page with user data and transactions', async () => {
      const user = { _id: 'test-user-id', username: 'testuser', wallet: 100 };
      const transactions = [{ type: 'deposit', amount: 100, timestamp: new Date() }];
      req.cookies.user = 'test-user-id';
      User.findById.mockReturnValue({ lean: () => Promise.resolve(user) });
      PaymentTransaction.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve(transactions) }) });

      await paymentController.showWallet(req, res);

      expect(User.findById).toHaveBeenCalledWith('test-user-id');
      expect(PaymentTransaction.find).toHaveBeenCalledWith({ userId: 'test-user-id' });
      expect(res.render).toHaveBeenCalledWith('wallet', {
        title: 'Wallet',
        user,
        transactions: expect.any(Array),
      });
    });
  });

  describe('addMoney', () => {
    it('should add money to the user wallet', async () => {
      const user = { _id: 'test-user-id', wallet: 150, save: jest.fn() };
      req.cookies.user = 'test-user-id';
      req.body = { amount: '50', cardNumber: '1234567812345678', cardHolder: 'Test User', expiryDate: '12/25', cvv: '123' };
      User.findByIdAndUpdate.mockResolvedValue(user);
      User.findById.mockResolvedValue(user);
      PaymentTransaction.prototype.save = jest.fn().mockResolvedValue(true);

      await paymentController.addMoney(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('test-user-id', { $inc: { wallet: 50 } });
      expect(PaymentTransaction.prototype.save).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Money added successfully', newBalance: 150 });
    });
  });

  describe('withdrawMoney', () => {
    it('should withdraw money from the user wallet', async () => {
      const user = { _id: 'test-user-id', wallet: 100, save: jest.fn() };
      req.cookies.user = 'test-user-id';
      req.body = { amount: '50', cardNumber: '1234567812345678', cardHolder: 'Test User', expiryDate: '12/25', cvv: '123' };
      User.findById
        .mockResolvedValueOnce({ _id: 'test-user-id', wallet: 100 }) // For balance check
        .mockResolvedValueOnce({ _id: 'test-user-id', wallet: 50 }); // For newBalance response
      User.findByIdAndUpdate.mockResolvedValue({ ...user, wallet: 50 });
      PaymentTransaction.prototype.save = jest.fn().mockResolvedValue(true);

      await paymentController.withdrawMoney(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('test-user-id', { $inc: { wallet: -50 } });
      expect(PaymentTransaction.prototype.save).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Withdrawal successful', newBalance: 50 });
    });

    it('should return an error for insufficient funds', async () => {
      const user = { _id: 'test-user-id', wallet: 40, save: jest.fn() };
      req.cookies.user = 'test-user-id';
      req.body = { amount: '50', cardNumber: '1234567812345678', cardHolder: 'Test User', expiryDate: '12/25', cvv: '123' };
      User.findById.mockResolvedValue(user);

      await paymentController.withdrawMoney(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Insufficient balance. Available: $40' });
    });
  });
});

