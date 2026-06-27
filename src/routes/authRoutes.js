const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    register,
    login,
    refreshAccessToken
} = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error:
            'Demasiados intentos de autenticación. Intenta nuevamente más tarde.'
    }
});

router.post(
    '/register',
    authLimiter,
    register
);

router.post(
    '/login',
    authLimiter,
    login
);

router.post(
    '/refresh',
    authLimiter,
    refreshAccessToken
);

module.exports = router;