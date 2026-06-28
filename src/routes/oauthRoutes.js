const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    showAuthorizationPage,
    authorizeUser,
    tokenEndpoint,
    callbackTest
} = require('../controllers/oauthController');

const router = express.Router();

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

router.post(
    '/token',
    oauthLimiter,
    tokenEndpoint
);

router.get(
    '/callback-test',
    callbackTest
);

module.exports = router;