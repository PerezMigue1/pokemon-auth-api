const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Convierte valores como:
 * 15m, 7d, 12h o 30s
 * a milisegundos.
 */
function durationToMilliseconds(value, fallbackMilliseconds) {
    if (!value || typeof value !== 'string') {
        return fallbackMilliseconds;
    }

    const match = value
        .trim()
        .toLowerCase()
        .match(/^(\d+)(s|m|h|d)$/);

    if (!match) {
        return fallbackMilliseconds;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const unitMilliseconds = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return amount * unitMilliseconds[unit];
}

function createAccessToken(user) {
    if (!user || !user._id) {
        throw new Error(
            'No se puede generar el token sin un usuario válido.'
        );
    }

    return jwt.sign(
        {
            tokenVersion: Number(user.tokenVersion || 0)
        },
        process.env.JWT_ACCESS_SECRET,
        {
            algorithm: 'HS256',
            subject: user._id.toString(),
            issuer: process.env.JWT_ISSUER,
            audience: process.env.JWT_AUDIENCE,
            expiresIn:
                process.env.ACCESS_TOKEN_EXPIRES_IN || '15m'
        }
    );
}

function createRefreshTokenValue() {
    return crypto
        .randomBytes(64)
        .toString('base64url');
}

function hashToken(token) {
    if (!token || typeof token !== 'string') {
        throw new Error(
            'No se puede calcular el hash de un token vacío.'
        );
    }

    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}

function verifyAccessToken(token) {
    if (!token || typeof token !== 'string') {
        throw new Error(
            'El access token es obligatorio.'
        );
    }

    return jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET,
        {
            algorithms: ['HS256'],
            issuer: process.env.JWT_ISSUER,
            audience: process.env.JWT_AUDIENCE
        }
    );
}

function getAccessTokenExpiresInSeconds() {
    const milliseconds = durationToMilliseconds(
        process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
        15 * 60 * 1000
    );

    return Math.floor(milliseconds / 1000);
}

function getRefreshTokenExpirationDate() {
    const milliseconds = durationToMilliseconds(
        process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
        7 * 24 * 60 * 60 * 1000
    );

    return new Date(Date.now() + milliseconds);
}

module.exports = {
    createAccessToken,
    createRefreshTokenValue,
    hashToken,
    verifyAccessToken,
    getAccessTokenExpiresInSeconds,
    getRefreshTokenExpirationDate
};