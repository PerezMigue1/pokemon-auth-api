const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const oauthRoutes = require('./routes/oauthRoutes');
const profileRoutes = require('./routes/profileRoutes');
const favoritesRoutes = require('./routes/favoritesRoutes');

const AMAZON_ORIGINS = [
    'https://pitangui.amazon.com',
    'https://layla.amazon.co.uk',
    'https://alexa.amazon.co.jp',
    'https://alexa.amazon.com'
];

const app = express();

/*
 * Render ejecuta la aplicación detrás de un proxy inverso.
 * Esto permite que Express y express-rate-limit obtengan
 * correctamente la dirección IP del usuario.
 */
app.set('trust proxy', 1);

app.disable('x-powered-by');

/*
 * CORS para el token endpoint de Alexa.
 * Debe estar antes de Helmet para que no sea bloqueado
 * por Cross-Origin-Resource-Policy.
 */
app.use('/oauth/token', (request, response, next) => {
    const origin = request.headers.origin;

    if (origin && AMAZON_ORIGINS.includes(origin)) {
        response.set('Access-Control-Allow-Origin', origin);
        response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        response.set('Access-Control-Max-Age', '86400');
        response.set('Vary', 'Origin');
    }

    if (request.method === 'OPTIONS') {
        return response.status(204).end();
    }

    next();
});

/*
 * Registro temporal de solicitudes.
 * Debe colocarse antes de archivos estáticos,
 * limitadores, rutas, 404 y manejador de errores.
 */
app.use((request, response, next) => {
    const startedAt = Date.now();

    console.log(
        `[ENTRADA] ${request.method} ${request.originalUrl}`
    );

    response.on('finish', () => {
        const elapsedTime =
            Date.now() - startedAt;

        console.log(
            `[SALIDA] ${request.method} ` +
            `${request.originalUrl} ` +
            `${response.statusCode} ` +
            `${elapsedTime}ms`
        );
    });

    next();
});

/*
 * Encabezados HTTP de seguridad.
 */
app.use(helmet());

/*
 * La página OAuth y las imágenes se cargan desde
 * el mismo dominio. La API no permite solicitudes
 * JavaScript desde otros orígenes.
 */
app.use(cors({
    origin: false
}));

/*
 * Lectura de cuerpos JSON.
 */
app.use(express.json({
    limit: '20kb'
}));

/*
 * OAuth utiliza application/x-www-form-urlencoded
 * para el endpoint de tokens y el formulario de acceso.
 */
app.use(express.urlencoded({
    extended: false,
    limit: '20kb'
}));

/*
 * Archivos públicos:
 * /images/pokeball.png
 */
app.use(express.static('public'));

/*
 * Limitador general de solicitudes.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error:
            'Demasiadas solicitudes. Intenta nuevamente más tarde.'
    }
});

app.use(generalLimiter);

/*
 * Comprobación del estado del servidor.
 */
app.get('/health', (request, response) => {
    return response.status(200).json({
        success: true,
        service: 'pokemon-auth-api',
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

/*
 * Rutas públicas de autenticación.
 */
app.use('/auth', authRoutes);

/*
 * Endpoints OAuth utilizados por Alexa.
 */
app.use('/oauth', oauthRoutes);

/*
 * Rutas protegidas mediante Bearer Token.
 */
app.use('/api/profile', profileRoutes);
app.use('/api/favorites', favoritesRoutes);

/*
 * Ruta no encontrada.
 * Debe ir después de todas las rutas válidas.
 */
app.use((request, response) => {
    return response.status(404).json({
        success: false,
        error: 'Ruta no encontrada.'
    });
});

/*
 * Manejador general de errores.
 * Debe ser el último middleware.
 */
app.use((error, request, response, next) => {
    console.error('[ERROR NO CONTROLADO]', {
        message: error.message,
        stack: error.stack,
        method: request.method,
        path: request.originalUrl
    });

    if (response.headersSent) {
        return next(error);
    }

    return response.status(500).json({
        success: false,
        error:
            'Ocurrió un error interno en el servidor.'
    });
});

module.exports = app;