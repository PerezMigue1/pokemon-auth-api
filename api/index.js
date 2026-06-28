require('dotenv').config();

console.log('[VERCEL ENV KEYS]', Object.keys(process.env).sort().join(', '));

const app = require('../src/app');
const connectDatabase = require('../src/config/database');

connectDatabase().catch((error) => {
    console.error('Error conectando a MongoDB:', error.message);
});

module.exports = app;
