const mongoose = require('mongoose');
const User = require('../../models/User');

describe('User Model', () => {
  it('should create a new user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@test.com',
      password: 'password123',
    };
    const user = new User(userData);
    await user.save();

    const foundUser = await User.findOne({ email: 'test@test.com' });
    expect(foundUser).toBeDefined();
    expect(foundUser.username).toBe(userData.username);
    expect(foundUser.wallet).toBe(0);
  });

  it('should not create a user without required fields', async () => {
    const user = new User({ username: 'test' });
    let err;
    try {
      await user.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.email).toBeDefined();
    expect(err.errors.password).toBeDefined();
  });

  it('should enforce unique username and email', async () => {
    const userData = {
      username: 'uniqueuser',
      email: 'unique@test.com',
      password: 'password123',
    };
    await new User(userData).save();

    let err;
    try {
      await new User(userData).save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
  });
});

