require('dotenv').config();

const app = require('./src/app');
const connectDatabase = require('./src/config/database');

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
    console.error(
        'Error iniciando el servidor:',
        error
    );

    process.exit(1);
});