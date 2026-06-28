require('dotenv').config();

const app = require('../src/app');
const connectDatabase = require('../src/config/database');

connectDatabase().catch((error) => {
    console.error('Error conectando a MongoDB:', error.message);
});

module.exports = app;
