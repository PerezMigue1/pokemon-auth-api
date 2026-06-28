const mongoose = require('mongoose');

let connected = false;

async function connectDatabase() {
    if (connected) {
        return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    connected = true;
    console.log('MongoDB conectado correctamente.');
}

module.exports = connectDatabase;
