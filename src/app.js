const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes =
    require('./routes/authRoutes');
const profileRoutes =
    require('./routes/profileRoutes');
const oauthRoutes =
    require('./routes/oauthRoutes');

const app = express();

app.set('trust proxy', 1);

app.disable('x-powered-by');

app.use(express.static('public'));

app.use(helmet());

app.use(cors({
    origin: false
}));

app.use(express.json({
    limit: '20kb'
}));

app.use(express.urlencoded({
    extended: false,
    limit: '20kb'
}));

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.'
    }
});

app.use(generalLimiter);

app.get('/health', (request, response) => {
    response.status(200).json({
        success: true,
        service: 'pokemon-auth-api',
        status: 'online'
    });
});

app.use('/auth', authRoutes);
app.use('/oauth', oauthRoutes);
app.use('/api/profile', profileRoutes);
app.use(
    express.static('public')
);

app.use((request, response) => {
    response.status(404).json({
        success: false,
        error: 'Ruta no encontrada.'
    });
});

app.use((error, request, response, next) => {
    console.error(error);

    response.status(500).json({
        success: false,
        error: 'Error interno del servidor.'
    });
});

app.use((request, response, next) => {
    const startedAt = Date.now();

    console.log(
        `[ENTRADA] ${request.method} ${request.originalUrl}`
    );

    response.on('finish', () => {
        console.log(
            `[SALIDA] ${request.method} ${request.originalUrl} ` +
            `${response.statusCode} ${Date.now() - startedAt}ms`
        );
    });

    next();
});

module.exports = app;