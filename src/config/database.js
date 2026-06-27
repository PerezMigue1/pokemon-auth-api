const mongoose = require('mongoose');

async function connectDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('MongoDB conectado correctamente.');
    } catch (error) {
        console.error(
            'No fue posible conectar con MongoDB:',
            error.message
        );

        process.exit(1);
    }
}

module.exports = connectDatabase;