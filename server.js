require('dotenv').config();

const app = require('./src/app');
const connectDatabase = require('./src/config/database');

/*
 * En Vercel (serverless) no hay servidor persistente.
 * Exportamos la app y conectamos la DB en cada cold start.
 * En local, arrancamos el servidor normalmente.
 */
if (process.env.VERCEL) {
    connectDatabase().catch((error) => {
        console.error('Error conectando a MongoDB:', error.message);
    });

    module.exports = app;
} else {
    const PORT = Number(process.env.PORT) || 3000;

    async function startServer() {
        await connectDatabase();

        app.listen(PORT, () => {
            console.log(
                `Servidor de autenticación ejecutándose en el puerto ${PORT}.`
            );
        });
    }

    startServer().catch((error) => {
        console.error('Error iniciando el servidor:', error);
        process.exit(1);
    });

    module.exports = app;
}
