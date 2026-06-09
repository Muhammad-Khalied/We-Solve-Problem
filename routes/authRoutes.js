const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('classSection').trim().isIn(['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C']).withMessage('Please select a valid class section (e.g. 1A, 2B)')
], register);

router.post('/login', login);
router.get('/me', auth, getMe);

module.exports = router;
