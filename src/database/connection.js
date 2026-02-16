import pg     from 'pg';          
import dotenv from 'dotenv';  
dotenv.config();           

const { Pool } = pg;         


const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
  max: 20,                                  // NUMERO MAXIMO DE CONEXIONES EN EL POOL
  idleTimeoutMillis: 30000,                 // TIEMPO MAXIMO QUE UNA CONEXIÓN PUEDE ESTAR INACTIVA (30 segundos)
  connectionTimeoutMillis: 2000,            // TIEMPO MAXIMO PARA ESTABLECER UNA NUEVA CONEXIÓN (2 segundos)
};

const pool = new Pool(dbConfig);
pool.on('error', (err, client) => {
  console.error('Error en el pool de PostgreSQL:', err);
});

// 1. FUNCION PARA RETORNAR EL POOL PARA USO EN OTRAS PARTES DE LA APLICACIÓN
export const getConnection = async () => {
  try {
    const client = await pool.connect();
    return client; 
  } catch (error) {
    console.error('Error al obtener cliente del pool de PostgreSQL:', error.message);
    throw error; 
  }
};

// 2. FUNCION PARA PROBAR LA CONEXIÓN A LA BASE DE DATOS
export const testDbConnection = async () => {
  let client;
  try {
      client = await getConnection();  
      await client.query('SELECT NOW()');
      console.log('Conexión a PostgreSQL establecida y probada exitosamente.');
  } catch (error) {
      console.error('Fallo al probar la conexión con PostgreSQL en testDbConnection.');
      throw error;
  } finally {
      if (client) {
          releaseConnection(client);      
      }
  }
};

// 3. FUNCION PARA LIBERAR LA CONEXIÓN AL POOL
export const releaseConnection = (client) => {
  if (client) {
    client.release();
  }
};