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
            
        )
        
    } catch (error) {
        
    }
 }