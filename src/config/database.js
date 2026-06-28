const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDatabase() {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    if (!connectionPromise) {
        connectionPromise = mongoose
            .connect(process.env.MONGODB_URI)
            .then(() => {
                console.log('MongoDB conectado correctamente.');
            });
    }

    await connectionPromise;
}

module.exports = connectDatabase;
