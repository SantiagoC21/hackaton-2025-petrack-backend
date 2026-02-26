import jwt from 'jsonwebtoken';
import { getConnection, releaseConnection } from "../database/connection.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = async (req, res, next) => {
    const token = req.cookies.authToken;

    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
    }

    const denyAccess = (code, message) => {
        res.clearCookie('authToken', cookieOptions);
        return res.status(code).json({
            status: "error",
            code: code,
            message: message
        });
    };
    
    // Caso: No hay token en la petición
    if (!token) {
        return res.status(401).json({
            status: "error",
            code: 401,
            message: "Acceso denegado: No se proporcionó token de autenticación."
        });
    }

    let client;

    try {

        const decodedJwtPayload = jwt.verify(token, JWT_SECRET);
        if (!decodedJwtPayload.sessionId) {
            return denyAccess(401, "Acceso denegado: Token incompleto (falta sessionId).");
        }

        client = await getConnection();
        await client.query("SET TIME ZONE 'America/Lima'");

        const sessionQuery = await client.query(
            'SELECT usuario_id, expires_at FROM sessions WHERE session_id = $1 AND expires_at > NOW()',
            [decodedJwtPayload.sessionId]
        );

        if (sessionQuery.rows.length === 0) {
            return denyAccess(401, "Tu sesión ha expirado o no es válida. Por favor, inicia sesión nuevamente.");
        }

        const sessionData = sessionQuery.rows[0];

        const userQuery = await client.query(
            'SELECT esta_verificado_email, esta_activo FROM usuarios WHERE id = $1',
            [sessionData.usuario_id]
        );

        if (userQuery.rows.length === 0 || !userQuery.rows[0].esta_verificado_email) {
            return denyAccess(403, "Acceso denegado: La cuenta de usuario no está verificada o no existe.");
        }

        req.user = {
            userId: sessionData.usuario_id,
            sessionId: decodedJwtPayload.sessionId,
            // Opcional: pasar is_active si lo necesitas en el siguiente middleware sin consultar DB de nuevo
            isActive: userQuery.rows[0].esta_activo 
        };
        
        // 5. CONTINUAR
        next();
    

    }

    catch (error) {
        // 6. MANEJO DE ERRORES DE JWT (Expirado o Manipulado)
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            return denyAccess(401, `Tu sesión ha caducado. (${error.message})`);
        }

        // 7. MANEJO DE ERRORES GENERALES DEL SERVIDOR
        console.error("Error en el middleware authenticateToken:", error);
        return res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor durante la autenticación."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
}

