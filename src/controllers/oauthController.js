const crypto = require('crypto');

const User = require('../models/User');
const AuthorizationCode =
    require('../models/AuthorizationCode');
const RefreshToken =
    require('../models/RefreshToken');

const {
    createAccessToken,
    createRefreshTokenValue,
    hashToken,
    getAccessTokenExpiresInSeconds,
    getRefreshTokenExpirationDate
} = require('../services/tokenService');

/*
 * Convierte caracteres especiales en entidades HTML
 * para evitar que datos externos se inserten directamente
 * en la página.
 */
function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getAllowedRedirectUris() {
    return String(
        process.env.ALEXA_REDIRECT_URIS || ''
    )
        .split(',')
        .map((uri) => uri.trim())
        .filter(Boolean);
}

function isAllowedRedirectUri(redirectUri) {
    return getAllowedRedirectUris().includes(
        String(redirectUri || '').trim()
    );
}

function isValidClientId(clientId) {
    return (
        typeof clientId === 'string' &&
        clientId === process.env.ALEXA_CLIENT_ID
    );
}

function safeEqual(valueA, valueB) {
    const bufferA = Buffer.from(
        String(valueA || ''),
        'utf8'
    );

    const bufferB = Buffer.from(
        String(valueB || ''),
        'utf8'
    );

    if (bufferA.length !== bufferB.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        bufferA,
        bufferB
    );
}

/*
 * Alexa puede enviar las credenciales OAuth mediante:
 *
 * Authorization: Basic base64(client_id:client_secret)
 *
 * o dentro del cuerpo de la solicitud.
 */
function extractClientCredentials(request) {
    const authorization =
        request.headers.authorization || '';

    if (
        typeof authorization === 'string' &&
        authorization.startsWith('Basic ')
    ) {
        try {
            const encodedCredentials =
                authorization.slice(6).trim();

            const decodedCredentials =
                Buffer.from(
                    encodedCredentials,
                    'base64'
                ).toString('utf8');

            const separatorIndex =
                decodedCredentials.indexOf(':');

            if (separatorIndex >= 0) {
                return {
                    clientId:
                        decodedCredentials.slice(
                            0,
                            separatorIndex
                        ),

                    clientSecret:
                        decodedCredentials.slice(
                            separatorIndex + 1
                        )
                };
            }
        } catch (error) {
            return {
                clientId: '',
                clientSecret: ''
            };
        }
    }

    return {
        clientId: String(
            request.body.client_id || ''
        ),

        clientSecret: String(
            request.body.client_secret || ''
        )
    };
}

function validateClient(request) {
    const credentials =
        extractClientCredentials(request);

    return (
        safeEqual(
            credentials.clientId,
            process.env.ALEXA_CLIENT_ID
        ) &&
        safeEqual(
            credentials.clientSecret,
            process.env.ALEXA_CLIENT_SECRET
        )
    );
}

function oauthError(
    response,
    status,
    error,
    description
) {
    response.set({
        'Cache-Control': 'no-store',
        Pragma: 'no-cache'
    });

    return response.status(status).json({
        error,
        error_description: description
    });
}

function buildAuthorizationPage(parameters, errorMessage = '') {
    const {
        clientId,
        redirectUri,
        state,
        scope,
        codeChallenge,
        codeChallengeMethod
    } = parameters;

    const renderedError = errorMessage
        ? `
            <div class="error">
                ${escapeHtml(errorMessage)}
            </div>
        `
        : '';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Vincular Galería Pokémon</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            font-family: Arial, sans-serif;
            background:
                linear-gradient(
                    145deg,
                    #07131f,
                    #123c54
                );
            color: #ffffff;
        }

        .card {
            width: 100%;
            max-width: 440px;
            padding: 32px;
            border-radius: 22px;
            background: rgba(8, 24, 38, 0.96);
            border: 2px solid #ffcb05;
            box-shadow:
                0 18px 45px rgba(0, 0, 0, 0.45);
        }

        .logo {
            display: block;
            width: 92px;
            height: 92px;
            object-fit: contain;
            margin: 0 auto 16px;
        }

        h1 {
            margin: 0 0 10px;
            text-align: center;
            font-size: 28px;
        }

        .description {
            margin: 0 0 24px;
            text-align: center;
            line-height: 1.5;
            color: #d7e4ec;
        }

        label {
            display: block;
            margin: 14px 0 7px;
            font-weight: 700;
        }

        input {
            width: 100%;
            min-height: 48px;
            padding: 12px 14px;
            border: 1px solid #9fb4c4;
            border-radius: 10px;
            background: #ffffff;
            color: #17202a;
            font-size: 16px;
        }

        button {
            width: 100%;
            min-height: 50px;
            margin-top: 22px;
            border: 0;
            border-radius: 10px;
            background: #ffcb05;
            color: #17202a;
            font-size: 17px;
            font-weight: 700;
            cursor: pointer;
        }

        button:hover {
            background: #f2b807;
        }

        .error {
            margin-bottom: 16px;
            padding: 12px;
            border-radius: 9px;
            background: #7c2020;
            color: #ffffff;
            line-height: 1.4;
        }

        .notice {
            margin-top: 18px;
            text-align: center;
            color: #afc1cd;
            font-size: 13px;
            line-height: 1.45;
        }
    </style>
</head>

<body>
    <main class="card">
        <img
            class="logo"
            src="/images/poke-ball.png"
            alt="Pokébola"
        >

        <h1>Galería Pokémon</h1>

        <p class="description">
            Inicia sesión para vincular tu cuenta con Alexa
            y utilizar funciones personales como favoritos.
        </p>

        ${renderedError}

        <form method="POST" action="/oauth/authorize">
            <input
                type="hidden"
                name="client_id"
                value="${escapeHtml(clientId)}"
            >

            <input
                type="hidden"
                name="redirect_uri"
                value="${escapeHtml(redirectUri)}"
            >

            <input
                type="hidden"
                name="state"
                value="${escapeHtml(state)}"
            >

            <input
                type="hidden"
                name="scope"
                value="${escapeHtml(scope)}"
            >

            <input
                type="hidden"
                name="response_type"
                value="code"
            >

            <input
                type="hidden"
                name="code_challenge"
                value="${escapeHtml(codeChallenge)}"
            >

            <input
                type="hidden"
                name="code_challenge_method"
                value="${escapeHtml(codeChallengeMethod)}"
            >

            <label for="email">
                Correo electrónico
            </label>

            <input
                id="email"
                name="email"
                type="email"
                autocomplete="username"
                required
            >

            <label for="password">
                Contraseña
            </label>

            <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
            >

            <button type="submit">
                Vincular cuenta
            </button>
        </form>

        <p class="notice">
            Alexa recibirá autorización para identificar tu
            cuenta y acceder a tus Pokémon favoritos.
        </p>
    </main>
</body>
</html>
    `;
}

function validateAuthorizationParameters(query) {
    const clientId =
        String(query.client_id || '').trim();

    const redirectUri =
        String(query.redirect_uri || '').trim();

    const responseType =
        String(query.response_type || '').trim();

    const state =
        String(query.state || '').trim();

    const scope =
        String(query.scope || '').trim();

    const codeChallenge =
        String(query.code_challenge || '').trim();

    const codeChallengeMethod =
        String(
            query.code_challenge_method || ''
        ).trim();

    if (!isValidClientId(clientId)) {
        return {
            valid: false,
            status: 400,
            message: 'El client_id no es válido.'
        };
    }

    if (!isAllowedRedirectUri(redirectUri)) {
        return {
            valid: false,
            status: 400,
            message:
                'La dirección de redirección no está permitida.'
        };
    }

    if (responseType !== 'code') {
        return {
            valid: false,
            status: 400,
            message:
                'Solo se admite response_type=code.'
        };
    }

    if (!state) {
        return {
            valid: false,
            status: 400,
            message:
                'El parámetro state es obligatorio.'
        };
    }

    /*
     * En nuestro servidor haremos obligatorio PKCE S256.
     */
    if (
        !codeChallenge ||
        codeChallengeMethod !== 'S256'
    ) {
        return {
            valid: false,
            status: 400,
            message:
                'Se requiere PKCE con code_challenge_method S256.'
        };
    }

    return {
        valid: true,
        parameters: {
            clientId,
            redirectUri,
            responseType,
            state,
            scope,
            codeChallenge,
            codeChallengeMethod
        }
    };
}

function showAuthorizationPage(
    request,
    response
) {
    const validation =
        validateAuthorizationParameters(
            request.query
        );

    if (!validation.valid) {
        return response
            .status(validation.status)
            .type('html')
            .send(
                `<h1>Solicitud OAuth inválida</h1>
                 <p>${escapeHtml(
                    validation.message
                )}</p>`
            );
    }

    console.log('[OAUTH] Solicitud de autorización:', {
        redirectUri:
            validation.parameters.redirectUri,

        stateLength:
            validation.parameters.state.length,

        stateFingerprint:
            fingerprint(
                validation.parameters.state
            ),

        codeChallengePresent:
            Boolean(
                validation.parameters.codeChallenge
            )
    });

    response.set({
        'Cache-Control': 'no-store',
        Pragma: 'no-cache'
    });

    return response
        .status(200)
        .type('html')
        .send(
            buildAuthorizationPage(
                validation.parameters
            )
        );
}

async function authorizeUser(
    request,
    response,
    next
) {
    try {
        const validation =
            validateAuthorizationParameters(
                request.body
            );

        if (!validation.valid) {
            return response
                .status(validation.status)
                .type('html')
                .send(
                    `<h1>Solicitud OAuth inválida</h1>
                     <p>${escapeHtml(
                        validation.message
                    )}</p>`
                );
        }

        const parameters =
            validation.parameters;

        const email = String(
            request.body.email || ''
        )
            .trim()
            .toLowerCase();

        const password =
            String(
                request.body.password || ''
            );

        const user = await User.findOne({
            email
        }).select('+passwordHash');

        const credentialsAreValid =
            user &&
            await user.verifyPassword(
                password
            );

        if (
            !credentialsAreValid ||
            !user.isActive
        ) {
            return response
                .status(401)
                .type('html')
                .send(
                    buildAuthorizationPage(
                        parameters,
                        'Correo o contraseña incorrectos.'
                    )
                );
        }

        /*
         * Código de autorización temporal.
         * Se guarda únicamente su hash en MongoDB.
         */
        const authorizationCode =
            crypto
                .randomBytes(16)
                .toString('base64url');

        await AuthorizationCode.create({
            codeHash:
                hashToken(
                    authorizationCode
                ),

            userId:
                user._id,

            clientId:
                parameters.clientId,

            redirectUri:
                parameters.redirectUri,

            scope:
                parameters.scope,

            codeChallenge:
                parameters.codeChallenge,

            codeChallengeMethod:
                parameters.codeChallengeMethod,

            expiresAt:
                new Date(
                    Date.now() +
                    5 * 60 * 1000
                )
        });

        const redirectUrl =
            new URL(
                parameters.redirectUri
            );

        redirectUrl.searchParams.set(
            'state',
            parameters.state
        );

        redirectUrl.searchParams.set(
            'code',
            authorizationCode
        );

        const finalRedirectUrl =
            redirectUrl.toString();

        console.log('[OAUTH] Redirección preparada:', {
            redirectUri:
                parameters.redirectUri,

            stateLength:
                parameters.state.length,

            stateFingerprint:
                fingerprint(
                    parameters.state
                ),

            authorizationCodeLength:
                authorizationCode.length,

            finalUrlLength:
                finalRedirectUrl.length,

            protocol:
                redirectUrl.protocol,

            hostname:
                redirectUrl.hostname
        });

        response.set({
            'Cache-Control': 'no-store',
            Pragma: 'no-cache'
        });

        return response.redirect(
            302,
            finalRedirectUrl
        );
    } catch (error) {
        console.error(
            '[OAUTH] Error autorizando usuario:',
            {
                message:
                    error.message,

                name:
                    error.name
            }
        );

        return next(error);
    }
}

function verifyPkce(
    codeVerifier,
    storedCodeChallenge
) {
    if (
        !codeVerifier ||
        !storedCodeChallenge
    ) {
        return false;
    }

    const calculatedChallenge =
        crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');

    return safeEqual(
        calculatedChallenge,
        storedCodeChallenge
    );
}

function fingerprint(value) {
    return crypto
        .createHash('sha256')
        .update(String(value || ''))
        .digest('hex')
        .slice(0, 16);
}

async function exchangeAuthorizationCode(
    request,
    response,
    next
) {
    try {
        console.log('[TOKEN] Solicitud de intercambio de código recibida desde:', {
            ip: request.ip,
            grantType: request.body.grant_type,
            hasCode: Boolean(request.body.code),
            hasCodeVerifier: Boolean(request.body.code_verifier)
        });

        if (!validateClient(request)) {
            return oauthError(
                response,
                401,
                'invalid_client',
                'Las credenciales del cliente no son válidas.'
            );
        }

        const code =
            String(request.body.code || '').trim();

        const redirectUri =
            String(
                request.body.redirect_uri || ''
            ).trim();

        const codeVerifier =
            String(
                request.body.code_verifier || ''
            ).trim();

        if (!code || !redirectUri) {
            return oauthError(
                response,
                400,
                'invalid_request',
                'Faltan code o redirect_uri.'
            );
        }

        const codeHash =
            hashToken(code);

        const authorizationCode =
            await AuthorizationCode.findOne({
                codeHash
            }).select('+codeHash');

        if (!authorizationCode) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El código de autorización no es válido.'
            );
        }

        if (authorizationCode.usedAt) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El código de autorización ya fue utilizado.'
            );
        }

        if (
            authorizationCode.expiresAt.getTime() <=
            Date.now()
        ) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El código de autorización ha expirado.'
            );
        }

        if (
            authorizationCode.clientId !==
            process.env.ALEXA_CLIENT_ID
        ) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El código no pertenece a este cliente.'
            );
        }

        if (
            authorizationCode.redirectUri !==
            redirectUri
        ) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El redirect_uri no coincide.'
            );
        }

        if (
            authorizationCode.codeChallenge &&
            !verifyPkce(
                codeVerifier,
                authorizationCode.codeChallenge
            )
        ) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'La comprobación PKCE no fue válida.'
            );
        }

        /*
         * Marcamos el código como usado mediante una
         * actualización condicional para evitar dos canjes.
         */
        const markResult =
            await AuthorizationCode.updateOne(
                {
                    _id: authorizationCode._id,
                    usedAt: null
                },
                {
                    $set: {
                        usedAt: new Date()
                    }
                }
            );

        if (markResult.modifiedCount !== 1) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El código ya fue utilizado.'
            );
        }

        const user = await User.findById(
            authorizationCode.userId
        );

        if (!user || !user.isActive) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'La cuenta asociada no está disponible.'
            );
        }

        const accessToken =
            createAccessToken(user);

        const refreshToken =
            createRefreshTokenValue();

        await RefreshToken.create({
            tokenHash:
                hashToken(refreshToken),

            userId:
                user._id,

            clientId:
                process.env.ALEXA_CLIENT_ID,

            expiresAt:
                getRefreshTokenExpirationDate()
        });

        response.set({
            'Cache-Control': 'no-store',
            Pragma: 'no-cache'
        });

        return response.status(200).json({
            access_token:
                accessToken,

            token_type:
                'Bearer',

            expires_in:
                getAccessTokenExpiresInSeconds(),

            refresh_token:
                refreshToken,

            scope:
                authorizationCode.scope || undefined
        });
    } catch (error) {
        return next(error);
    }
}

async function refreshOAuthToken(
    request,
    response,
    next
) {
    try {
        if (!validateClient(request)) {
            return oauthError(
                response,
                401,
                'invalid_client',
                'Las credenciales del cliente no son válidas.'
            );
        }

        const refreshTokenValue =
            String(
                request.body.refresh_token || ''
            ).trim();

        if (!refreshTokenValue) {
            return oauthError(
                response,
                400,
                'invalid_request',
                'El refresh_token es obligatorio.'
            );
        }

        const currentTokenHash =
            hashToken(refreshTokenValue);

        const storedToken =
            await RefreshToken.findOne({
                tokenHash: currentTokenHash
            }).select('+tokenHash');

        if (!storedToken) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El refresh token no es válido.'
            );
        }

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

            return oauthError(
                response,
                400,
                'invalid_grant',
                'Se detectó reutilización del refresh token.'
            );
        }

        if (
            storedToken.expiresAt.getTime() <=
            Date.now()
        ) {
            storedToken.revokedAt = new Date();
            await storedToken.save();

            return oauthError(
                response,
                400,
                'invalid_grant',
                'El refresh token ha expirado.'
            );
        }

        if (
            storedToken.clientId !==
            process.env.ALEXA_CLIENT_ID
        ) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El refresh token no pertenece al cliente.'
            );
        }

        const user = await User.findById(
            storedToken.userId
        );

        if (!user || !user.isActive) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'La cuenta ya no está disponible.'
            );
        }

        const newRefreshToken =
            createRefreshTokenValue();

        const newRefreshTokenHash =
            hashToken(newRefreshToken);

        const rotationResult =
            await RefreshToken.updateOne(
                {
                    _id: storedToken._id,
                    revokedAt: null
                },
                {
                    $set: {
                        revokedAt:
                            new Date(),

                        replacedByTokenHash:
                            newRefreshTokenHash
                    }
                }
            );

        if (rotationResult.modifiedCount !== 1) {
            return oauthError(
                response,
                400,
                'invalid_grant',
                'El refresh token ya fue utilizado.'
            );
        }

        await RefreshToken.create({
            tokenHash:
                newRefreshTokenHash,

            userId:
                user._id,

            clientId:
                process.env.ALEXA_CLIENT_ID,

            expiresAt:
                getRefreshTokenExpirationDate()
        });

        response.set({
            'Cache-Control': 'no-store',
            Pragma: 'no-cache'
        });

        return response.status(200).json({
            access_token:
                createAccessToken(user),

            token_type:
                'Bearer',

            expires_in:
                getAccessTokenExpiresInSeconds(),

            refresh_token:
                newRefreshToken
        });
    } catch (error) {
        return next(error);
    }
}

async function tokenEndpoint(
    request,
    response,
    next
) {
    const grantType =
        String(
            request.body.grant_type || ''
        ).trim();

    if (grantType === 'authorization_code') {
        return exchangeAuthorizationCode(
            request,
            response,
            next
        );
    }

    if (grantType === 'refresh_token') {
        return refreshOAuthToken(
            request,
            response,
            next
        );
    }

    return oauthError(
        response,
        400,
        'unsupported_grant_type',
        'El grant_type solicitado no es compatible.'
    );
}

function callbackTest(request, response) {
    const code =
        escapeHtml(request.query.code);

    const state =
        escapeHtml(request.query.state);

    return response
        .status(200)
        .type('html')
        .send(`
            <h1>Autorización local completada</h1>

            <p>
                El servidor generó correctamente
                un código de autorización.
            </p>

            <p>
                <strong>Code:</strong>
                <code>${code}</code>
            </p>

            <p>
                <strong>State:</strong>
                <code>${state}</code>
            </p>

            <p>
                Copia el código para probar
                el endpoint /oauth/token.
            </p>
        `);
}

module.exports = {
    showAuthorizationPage,
    authorizeUser,
    tokenEndpoint,
    callbackTest
};