const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const {
    showAuthorizationPage,
    authorizeUser,
    tokenEndpoint,
    callbackTest
} = require('../controllers/oauthController');

const router = express.Router();

const amazonCors = cors({
    origin: [
        'https://pitangui.amazon.com',
        'https://layla.amazon.co.uk',
        'https://alexa.amazon.co.jp',
        'https://alexa.amazon.com'
    ],
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'temporarily_unavailable',
        error_description:
            'Demasiadas solicitudes OAuth.'
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message:
        'Demasiados intentos de inicio de sesión.'
});

router.get(
    '/authorize',
    oauthLimiter,
    showAuthorizationPage
);

router.post(
    '/authorize',
    loginLimiter,
    authorizeUser
);

router.options('/token', amazonCors);

router.post(
    '/token',
    amazonCors,
    oauthLimiter,
    tokenEndpoint
);

router.get(
    '/callback-test',
    callbackTest
);

module.exports = router;