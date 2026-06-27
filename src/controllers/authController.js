const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const {
    createAccessToken,
    createRefreshTokenValue,
    hashToken,
    getAccessTokenExpiresInSeconds,
    getRefreshTokenExpirationDate
} = require('../services/tokenService');

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function validatePassword(password) {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        password.length <= 72 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /\d/.test(password)
    );
}

async function register(request, response, next) {
    try {
        const name = String(request.body.name || '').trim();
        const email = normalizeEmail(request.body.email);
        const password = request.body.password;

        if (
            name.length < 2 ||
            name.length > 80
        ) {
            return response.status(400).json({
                success: false,
                error:
                    'El nombre debe tener entre 2 y 80 caracteres.'
            });
        }

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return response.status(400).json({
                success: false,
                error:
                    'El correo electrónico no es válido.'
            });
        }

        if (!validatePassword(password)) {
            return response.status(400).json({
                success: false,
                error:
                    'La contraseña debe tener entre 8 y 72 caracteres, una mayúscula, una minúscula y un número.'
            });
        }

        const existingUser = await User.findOne({
            email
        }).lean();

        if (existingUser) {
            return response.status(409).json({
                success: false,
                error:
                    'Ya existe una cuenta con ese correo electrónico.'
            });
        }

        const passwordHash =
            await User.hashPassword(password);

        const user = await User.create({
            name,
            email,
            passwordHash
        });

        return response.status(201).json({
            success: true,
            message:
                'Usuario registrado correctamente.',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        if (error && error.code === 11000) {
            return response.status(409).json({
                success: false,
                error:
                    'Ya existe una cuenta con ese correo electrónico.'
            });
        }

        return next(error);
    }
}

async function login(request, response, next) {
    try {
        const email = normalizeEmail(request.body.email);
        const password = request.body.password;

        if (!email || !password) {
            return response.status(400).json({
                success: false,
                error:
                    'Debes proporcionar correo y contraseña.'
            });
        }

        const user = await User.findOne({
            email
        }).select('+passwordHash');

        if (!user) {
            return response.status(401).json({
                success: false,
                error:
                    'Correo o contraseña incorrectos.'
            });
        }

        if (!user.isActive) {
            return response.status(403).json({
                success: false,
                error:
                    'La cuenta está desactivada.'
            });
        }

        const passwordIsValid =
            await user.verifyPassword(password);

        if (!passwordIsValid) {
            return response.status(401).json({
                success: false,
                error:
                    'Correo o contraseña incorrectos.'
            });
        }

        const accessToken =
            createAccessToken(user);

        const refreshToken =
            createRefreshTokenValue();

        const refreshTokenHash =
            hashToken(refreshToken);

        const refreshExpiration =
            getRefreshTokenExpirationDate();

        await RefreshToken.create({
            tokenHash: refreshTokenHash,
            userId: user._id,
            clientId:
                process.env.ALEXA_CLIENT_ID,
            expiresAt: refreshExpiration
        });

        return response.status(200).json({
            success: true,
            tokenType: 'Bearer',
            accessToken,
            expiresIn: getAccessTokenExpiresInSeconds(),
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        return next(error);
    }
}

async function refreshAccessToken(
    request,
    response,
    next
) {
    try {
        const refreshTokenValue =
            String(
                request.body.refreshToken || ''
            ).trim();

        const clientId =
            String(
                request.body.clientId ||
                process.env.ALEXA_CLIENT_ID ||
                ''
            ).trim();

        if (!refreshTokenValue) {
            return response.status(400).json({
                success: false,
                error:
                    'Debes proporcionar el refresh token.',
                code:
                    'REFRESH_TOKEN_REQUIRED'
            });
        }

        if (
            !clientId ||
            clientId !== process.env.ALEXA_CLIENT_ID
        ) {
            return response.status(401).json({
                success: false,
                error:
                    'El cliente OAuth no es válido.',
                code:
                    'INVALID_CLIENT'
            });
        }

        const currentTokenHash =
            hashToken(refreshTokenValue);

        /*
         * Primero localizamos el token, aunque ya haya sido
         * revocado, para detectar intentos de reutilización.
         */
        const storedToken =
            await RefreshToken.findOne({
                tokenHash: currentTokenHash
            }).select('+tokenHash');

        if (!storedToken) {
            return response.status(401).json({
                success: false,
                error:
                    'El refresh token no es válido.',
                code:
                    'REFRESH_TOKEN_INVALID'
            });
        }

        /*
         * Un token previamente utilizado o revocado
         * no puede volver a utilizarse.
         */
        if (storedToken.revokedAt) {
            await RefreshToken.updateMany(
                {
                    userId: storedToken.userId,
                    revokedAt: null
                },
                {
                    $set: {
                        revokedAt: new Date()
                    }
                }
            );

            await User.findByIdAndUpdate(
                storedToken.userId,
                {
                    $inc: {
                        tokenVersion: 1
                    }
                }
            );

            return response.status(401).json({
                success: false,
                error:
                    'Se detectó la reutilización de un refresh token. Todas las sesiones fueron revocadas.',
                code:
                    'REFRESH_TOKEN_REUSE_DETECTED'
            });
        }

        if (
            storedToken.expiresAt.getTime() <=
            Date.now()
        ) {
            storedToken.revokedAt = new Date();

            await storedToken.save();

            return response.status(401).json({
                success: false,
                error:
                    'El refresh token ha expirado.',
                code:
                    'REFRESH_TOKEN_EXPIRED'
            });
        }

        if (
            storedToken.clientId !== clientId
        ) {
            return response.status(401).json({
                success: false,
                error:
                    'El refresh token no pertenece a este cliente.',
                code:
                    'REFRESH_TOKEN_CLIENT_MISMATCH'
            });
        }

        const user = await User.findById(
            storedToken.userId
        );

        if (!user) {
            storedToken.revokedAt = new Date();

            await storedToken.save();

            return response.status(401).json({
                success: false,
                error:
                    'El usuario asociado al token no existe.',
                code:
                    'REFRESH_TOKEN_USER_NOT_FOUND'
            });
        }

        if (!user.isActive) {
            storedToken.revokedAt = new Date();

            await storedToken.save();

            return response.status(403).json({
                success: false,
                error:
                    'La cuenta está desactivada.',
                code:
                    'ACCOUNT_DISABLED'
            });
        }

        /*
         * Generamos el nuevo refresh token.
         */
        const newRefreshTokenValue =
            createRefreshTokenValue();

        const newRefreshTokenHash =
            hashToken(newRefreshTokenValue);

        /*
         * Marcamos el token anterior como utilizado.
         * La actualización es condicional para evitar
         * que dos solicitudes lo usen simultáneamente.
         */
        const rotationResult =
            await RefreshToken.updateOne(
                {
                    _id: storedToken._id,
                    revokedAt: null
                },
                {
                    $set: {
                        revokedAt: new Date(),
                        replacedByTokenHash:
                            newRefreshTokenHash
                    }
                }
            );

        if (rotationResult.modifiedCount !== 1) {
            await RefreshToken.updateMany(
                {
                    userId: storedToken.userId,
                    revokedAt: null
                },
                {
                    $set: {
                        revokedAt: new Date()
                    }
                }
            );

            await User.findByIdAndUpdate(
                storedToken.userId,
                {
                    $inc: {
                        tokenVersion: 1
                    }
                }
            );

            return response.status(401).json({
                success: false,
                error:
                    'Se detectó un uso simultáneo del refresh token. Todas las sesiones fueron revocadas.',
                code:
                    'REFRESH_TOKEN_REUSE_DETECTED'
            });
        }

        await RefreshToken.create({
            tokenHash: newRefreshTokenHash,
            userId: user._id,
            clientId,
            expiresAt:
                getRefreshTokenExpirationDate()
        });

        const newAccessToken =
            createAccessToken(user);

        return response.status(200).json({
            success: true,
            tokenType: 'Bearer',
            accessToken:
                newAccessToken,
            expiresIn:
                getAccessTokenExpiresInSeconds(),
            refreshToken:
                newRefreshTokenValue
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    register,
    login,
    refreshAccessToken
};