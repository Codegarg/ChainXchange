const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');

describe('Transaction Model', () => {
  let user;

  beforeAll(async () => {
    user = new User({
      username: 'transactionuser',
      email: 'transaction@test.com',
      password: 'password',
    });
    await user.save();
  });

  it('should create a new transaction', async () => {
    const transactionData = {
      userId: user._id,
      type: 'buy',
      coinId: 'ethereum',
      quantity: 10,
      price: 3000,
      totalCost: 30000,
    };
    const transaction = new Transaction(transactionData);
    await transaction.save();

    const foundTransaction = await Transaction.findOne({ userId: user._id, coinId: 'ethereum' });
    expect(foundTransaction).toBeDefined();
    expect(foundTransaction.quantity).toBe(10);
    expect(foundTransaction.type).toBe('buy');
  });

  it('should only allow "buy" or "sell" for type', async () => {
    const transactionData = {
      userId: user._id,
      type: 'invalidtype',
      coinId: 'ethereum',
      quantity: 10,
      price: 3000,
    };
    const transaction = new Transaction(transactionData);
    let err;
    try {
      await transaction.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.type).toBeDefined();
  });
});

