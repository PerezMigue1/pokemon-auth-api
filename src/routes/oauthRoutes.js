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

/*
 * Endpoint temporal de diagnóstico.
 * Captura exactamente lo que Amazon envía al token endpoint.
 * ELIMINAR después de identificar el problema.
 */
router.all('/token-debug', (request, response) => {
    console.log('[TOKEN-DEBUG] ============================================');
    console.log('[TOKEN-DEBUG] Method:', request.method);
    console.log('[TOKEN-DEBUG] Headers:', JSON.stringify(request.headers, null, 2));
    console.log('[TOKEN-DEBUG] Body:', JSON.stringify(request.body, null, 2));
    console.log('[TOKEN-DEBUG] Query:', JSON.stringify(request.query, null, 2));
    console.log('[TOKEN-DEBUG] ============================================');

    return response.status(200).json({
        access_token: 'debug-token-amazon-called-this',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'debug-refresh-token'
    });
});

module.exports = router;