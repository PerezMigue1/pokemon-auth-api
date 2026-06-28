require('dotenv').config();

console.log('[VERCEL ENV CHECK]', {
    hasClientId: Boolean(process.env.ALEXA_CLIENT_ID),
    hasMongoUri: Boolean(process.env.MONGODB_URI),
    hasJwtSecret: Boolean(process.env.JWT_ACCESS_SECRET),
    nodeEnv: process.env.NODE_ENV
});

const app = require('../src/app');
const connectDatabase = require('../src/config/database');

connectDatabase().catch((error) => {
    console.error('Error conectando a MongoDB:', error.message);
});

module.exports = app;
