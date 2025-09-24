# Controllers

This folder contains the controller classes that handle the business logic for the ChainXchange application following the MVC (Model-View-Controller) pattern.

## Structure

### AuthController (`authController.js`)
Handles all authentication-related operations:
- **showSignup()** - Display signup page
- **signup()** - Process user registration
- **showLogin()** - Display login page  
- **login()** - Process user login
- **logout()** - Handle user logout
- **showProfile()** - Display user profile page

### CryptoController (`cryptoController.js`)
Manages cryptocurrency trading and portfolio operations:
- **showMarkets()** - Display cryptocurrency market listings
- **buyCrypto()** - Handle cryptocurrency purchases
- **sellCrypto()** - Handle cryptocurrency sales
- **showPortfolio()** - Display user's portfolio with P&L calculations
- **getChartData()** - Provide chart data for cryptocurrencies

### HomeController (`homeController.js`)
Handles main application pages:
- **showHome()** - Display homepage with market overview

## Benefits of Controller Pattern

1. **Separation of Concerns**: Business logic is separated from routes
2. **Reusability**: Controller methods can be used across multiple routes
3. **Testability**: Easy to unit test individual controller methods
4. **Maintainability**: Cleaner, more organized codebase
5. **Scalability**: Easy to add new features without bloating route files

## Usage

Controllers are imported and used in route files:

```javascript
const AuthController = require('../controllers/authController');
router.get('/login', AuthController.showLogin);
router.post('/login', AuthController.login);
```

All controller methods are static, so they can be called directly on the class without instantiation.