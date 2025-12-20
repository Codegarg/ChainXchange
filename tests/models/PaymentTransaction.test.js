const mongoose = require('mongoose');
const PaymentTransaction = require('../../models/PaymentTransaction');
const User =require('../../models/User');

describe('PaymentTransaction Model', () => {
  let user;

  beforeAll(async () => {
    user = new User({
      username: 'paymentuser',
      email: 'payment@test.com',
      password: 'password',
    });
    await user.save();
  });

  it('should create a new payment transaction', async () => {
    const paymentData = {
      userId: user._id,
      type: 'deposit',
      amount: 100,
      cardNumber: '**** **** **** 1234',
      cardHolder: 'Test User',
    };
    const paymentTx = new PaymentTransaction(paymentData);
    await paymentTx.save();

    const foundTx = await PaymentTransaction.findOne({ userId: user._id });
    expect(foundTx).toBeDefined();
    expect(foundTx.amount).toBe(100);
    expect(foundTx.status).toBe('completed');
  });

  it('should only allow valid types and statuses', async () => {
    let paymentTx = new PaymentTransaction({
      userId: user._id,
      type: 'invalidtype',
      amount: 100,
      cardNumber: '1234',
      cardHolder: 'Test',
    });
    let err;
    try {
      await paymentTx.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.type).toBeDefined();

    paymentTx = new PaymentTransaction({
        userId: user._id,
        type: 'deposit',
        amount: 100,
        cardNumber: '1234',
        cardHolder: 'Test',
        status: 'invalidstatus',
      });
      err = undefined;
      try {
        await paymentTx.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.status).toBeDefined();
  });
});

