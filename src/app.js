// src/app.js
import express      from 'express';
import cookieParser from 'cookie-parser';          // Para parsear cookies
import apiRoutes    from './routes/api.routes.js'; // Tu archivo de rutas donde definirás los endpoints
import cors         from 'cors';

const app = express();

// 1. CONFIGURACIÓN DE CORS ESPECÍFICA
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002'
];

// 2. CONFIGURACIÓN DE CORS
const corsOptions = {
    origin: function (origin, callback) {
        // 2.1. Log para depuración, ver qué origen se está intentando acceder
        console.log("CORS check. Request origin:", origin);

        // 2.2. Permite solicitudes sin origen (Postman, apps móviles) o si está en la lista
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            console.log("CORS allowed for origin:", origin);
            callback(null, true);
        } else {
            // 2.3. Si el origen no está permitido, se lanza un error
            console.warn(`Origin not allowed by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,                                                     // ¡MUY IMPORTANTE! Permite cookies y cabeceras de autorización.
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],         // Métodos HTTP permitidos
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Cabeceras permitidas en la petición
};

// =============================================================
// MIDDLEWARES GLOBALES QUE APLICAN A TODAS LAS SOLICITUDES
// =============================================================
// 3. CORS DEBE IR ANTER que de cualquier middleware que maneje cookies o autorización
app.use(cors(corsOptions));

// 4. MIDDLEWARES PARA PARSEAR JSON Y COOKIES
app.use(express.json());
app.use(cookieParser());

// 5. MIDDLEWARES PARA RUTAS DE API
app.use('/api', apiRoutes); 

// 6. MIDDLEWARES PARA MANEJO DE ERRORES
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Ruta no encontrada.'
    });
});

// 7. MIDDLEWARE PARA MANEJO DE ERRORES NO MANEJADOS
app.use((err, req, res, next) => {
    console.error("Error no manejado:", err.stack || err.message || err);
    // 7.1. Si es un error de CORS generado por nuestra función de origin, devolvemos un 403    
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            status: 'error',
            code: 403,
            message: 'Acceso denegado por política CORS.'
        });
    }
    res.status(err.status || 500).json({
        status: 'error',
        code: err.status || 500,
        message: err.message || 'Error interno del servidor.'
    });
});


export default app;
