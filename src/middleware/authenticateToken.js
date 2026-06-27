const jwt = require('jsonwebtoken');

const User = require('../models/User');
const {
    verifyAccessToken
} = require('../services/tokenService');

function extractBearerToken(request) {
    const authorizationHeader =
        request.headers.authorization;

    if (
        !authorizationHeader ||
        typeof authorizationHeader !== 'string'
    ) {
        return null;
    }

    const parts =
        authorizationHeader.trim().split(/\s+/);

    if (
        parts.length !== 2 ||
        parts[0].toLowerCase() !== 'bearer' ||
        !parts[1]
    ) {
        return null;
    }

    return parts[1];
}

async function authenticateToken(
    request,
    response,
    next
) {
    try {
        const accessToken =
            extractBearerToken(request);

        if (!accessToken) {
            return response.status(401).json({
                success: false,
                error:
                    'Debes proporcionar un access token mediante Authorization: Bearer.'
            });
        }

        let decodedToken;

        try {
            decodedToken =
                verifyAccessToken(accessToken);
        } catch (error) {
            if (
                error instanceof jwt.TokenExpiredError
            ) {
                return response.status(401).json({
                    success: false,
                    error:
                        'El access token ha expirado.',
                    code:
                        'ACCESS_TOKEN_EXPIRED'
                });
            }

            if (
                error instanceof jwt.JsonWebTokenError
            ) {
                return response.status(401).json({
                    success: false,
                    error:
                        'El access token no es válido.',
                    code:
                        'ACCESS_TOKEN_INVALID'
                });
            }

            throw error;
        }

        if (
            !decodedToken ||
            !decodedToken.sub
        ) {
            return response.status(401).json({
                success: false,
                error:
                    'El access token no contiene un usuario válido.',
                code:
                    'TOKEN_SUBJECT_MISSING'
            });
        }

        const user = await User.findById(
            decodedToken.sub
        );

        if (!user) {
            return response.status(401).json({
                success: false,
                error:
                    'El usuario asociado al token no existe.',
                code:
                    'TOKEN_USER_NOT_FOUND'
            });
        }

        if (!user.isActive) {
            return response.status(403).json({
                success: false,
                error:
                    'La cuenta se encuentra desactivada.',
                code:
                    'ACCOUNT_DISABLED'
            });
        }

        if (
            Number(decodedToken.tokenVersion) !==
            Number(user.tokenVersion)
        ) {
            return response.status(401).json({
                success: false,
                error:
                    'El access token fue revocado.',
                code:
                    'ACCESS_TOKEN_REVOKED'
            });
        }

        request.auth = {
            accessToken,
            tokenPayload: decodedToken,
            user
        };

        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = authenticateToken;