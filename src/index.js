// 1. CARGAR VARIABLES DE ENTORNO PRIMERO
import dotenv               from 'dotenv';
dotenv.config();

// 2. OTRAS IMPORTACIONES NECESARIAS
import app                  from './app.js';
import { testDbConnection } from './database/connection.js';

/*
import { startSubscriptionManager } from './cron/subscriptionManager.js';
*/

// 3. OBTENER EL PUERTO DESDE LAS VARIABLES DE ENTORNO
const PORT = process.env.PORT;

// 4. FUNCIÓN PRINCIPAL PARA INICIAR EL SERVIDOR
async function main() {
    try {
        // 4.1. Verificar que las variables de entorno críticas están definidas
        if (!process.env.PORT) {
            console.error("¡ERROR CRÍTICO: La variable de entorno PORT no está definida!");
            process.exit(1);
        }
        /*
        if (!process.env.JWT_SECRET) {
            console.error("¡ERROR CRÍTICO: La variable de entorno JWT_SECRET no está definida!");
            process.exit(1);
        }
        */
        await testDbConnection();

        // Iniciar los cron jobs de la aplicación
        startSubscriptionManager();

        app.listen(PORT, () => {
            console.log(`Puerto: ${PORT}`);
            console.log(`Entorno: ${process.env.NODE_ENV || 'no definido (default: development)'}\n`);
            console.log('Server started successfully ...');
        });
    } catch (error) {
        console.error('No se pudo iniciar el servidor o conectar a la base de datos:', error);
        process.exit(1);
    }
}

// 5. EJECUTAR LA FUNCIÓN PRINCIPAL
main();