const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const authController = require('../../controllers/authController');
const User = require('../../models/User');

// Mock the User model
jest.mock('..\/..\/...\/..\/models/User');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: true,
}));

// Mock res.render
app.use((req, res, next) => {
  res.render = (view, options) => {
    res.send({ view, options });
  };
  res.redirect = (url) => {
    res.send({ redirect: url });
  };
  res.cookie = jest.fn();
  next();
});

app.get('/signup', authController.showSignup);
app.post('/signup', authController.signup);
app.get('/login', authController.showLogin);
app.post('/login', authController.login);
app.get('/logout', authController.logout);
app.get('/profile', authController.showProfile);

describe('Auth Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('showSignup', () => {
    it('should render the signup page', async () => {
      const res = await request(app).get('/signup');
      expect(res.status).toBe(200);
      expect(res.body.view).toBe('signup');
      expect(res.body.options.title).toBe('Sign Up');
    });
  });

  describe('signup', () => {
    it('should create a new user and redirect to profile', async () => {
      User.findOne.mockResolvedValue(null);
      User.prototype.save = jest.fn().mockResolvedValue({ _id: 'some-id' });

      const res = await request(app)
        .post('/signup')
        .send({ username: 'testuser', email: 'test@test.com', password: 'password' });

      expect(res.status).toBe(200);
      expect(User.findOne).toHaveBeenCalledTimes(1);
      expect(User.prototype.save).toHaveBeenCalledTimes(1);
      expect(res.body.redirect).toBe('/profile');
    });

    it('should return an error if fields are missing', async () => {
        const res = await request(app)
          .post('/signup')
          .send({ username: 'testuser', email: 'test@test.com' });
  
        expect(res.status).toBe(200);
        expect(res.body.options.error).toBe('All fields are required.');
      });
  
      it('should return an error if user already exists', async () => {
        User.findOne.mockResolvedValue({ username: 'testuser' });
  
        const res = await request(app)
          .post('/signup')
          .send({ username: 'testuser', email: 'test@test.com', password: 'password' });
  
        expect(res.status).toBe(200);
        expect(res.body.options.error).toBe('Username or email already exists.');
      });
  });

  describe('showLogin', () => {
    it('should render the login page', async () => {
      const res = await request(app).get('/login');
      expect(res.status).toBe(200);
      expect(res.body.view).toBe('login');
      expect(res.body.options.title).toBe('Login');
    });
  });

  describe('login', () => {
    it('should login a user and redirect to profile', async () => {
        const bcrypt = require('bcrypt');
        const user = {
            _id: 'some-id',
            username: 'testuser',
            password: await bcrypt.hash('password', 10),
        };
        User.findOne.mockResolvedValue(user);
        const bcryptCompare = jest.spyOn(require('bcrypt'), 'compare');
        bcryptCompare.mockResolvedValue(true);


        const res = await request(app)
            .post('/login')
            .send({ username: 'testuser', password: 'password' });

        expect(res.status).toBe(200);
        expect(User.findOne).toHaveBeenCalledTimes(1);
        expect(res.body.redirect).toBe('/profile');
    });

    it('should return an error for invalid credentials', async () => {
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
            .post('/login')
            .send({ username: 'wronguser', password: 'wrongpassword' });

        expect(res.status).toBe(200);
        expect(res.body.options.error).toBe('Invalid username or password.');
    });
  });

  describe('logout', () => {
    it('should log the user out and redirect to home', async () => {
        const res = await request(app).get('/logout');
        expect(res.status).toBe(200);
        expect(res.body.redirect).toBe('/');
    });
  });

});

