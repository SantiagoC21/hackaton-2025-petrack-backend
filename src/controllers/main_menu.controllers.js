import { getConnection, releaseConnection } from '../database/connection.js';

export const getUserHeaderData = async (req, res) => {
    let client;

    try {
        const userId = req.user?.userId;
        if (!userId){
            return res.status(400).json({
                status: 'error',
                code: 400,
                message: 'No se proporciono un ID de usuario'
            })
        }

        client = await getConnection();

        const requestJsonToPg = JSON.stringify({
            user_id: userId
        });

        const pgResponse = await client.query(
            'SELECT * FROM api_get_user_header_data($1)', 
            [requestJsonToPg]
        );

        const result = pgResponse.rows[0]?.api_get_user_header_data;

        if (!result) {
            console.error(`No result from api_get_user_header_data for userId: ${userId}`);
            return res.status(500).json({ status: "error", code: 500, message: "Error obteniendo los datos de cabecera del usuario." });
        }
        
        if (result.status !== 'success') {
            return res.status(result.code || 500).json(result);
        }
        
        res.status(200).json({
            status: "success",
            code: 200,
            message: result.message,
            data: result.data
        });

        
    } catch (error) {
        console.error("Error en getUserHeaderData:", error);
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor al obtener los datos de cabecera del usuario."
        });

    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};