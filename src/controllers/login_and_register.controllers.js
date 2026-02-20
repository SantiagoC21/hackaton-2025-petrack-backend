import dotenv from 'dotenv';
dotenv.config();

import { getConnection, releaseConnection } from '../database/connection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { sendEmailVerificationCode, sendWhatsAppVerificationCode } from '../services/notificacionServices.js';

const { JWT_SECRET } = process.env;
const SESSION_DURATION_HOURS = parseInt(process.env.SESSION_DURATION_HOURS ?? '4', 10);

export const loginUser = async (req, res) => {
    let client;
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Email y contraseña son requeridos."
            });
        }
        client = await getConnection();
        
        const requestJsonToPg = JSON.stringify({ email, password });
        
        const pgResponse = await client.query('SELECT * FROM api_user_login_local($1)', [requestJsonToPg]);
        const loginResult = pgResponse.rows[0].api_user_login_local;

        // 1. MANEJO DE ERRORES DE LA FUNCIÓN PG
        if (loginResult.status !== 'success') {
            // CASO: EMAIL NO VERIFICADO
            if (loginResult.code === 403) {
                return res.status(403).json({
                    status: "error",
                    code: 403,
                    message: loginResult.message,
                    data: { email: loginResult.user_data?.email }
                });
            }

            // CASO: USUARIO SOCIAL O NO TIENE CONTRASEÑA LOCAL
            if (loginResult.code === 428) {
                 return res.status(428).json({
                    status: "error",
                    code: 428,
                    message: loginResult.message,
                    data: { 
                        auth_provider: loginResult.user_data?.auth_provider,
                        name: loginResult.user_data?.name
                    }
                 });
            }

            // CASO: CONTRASEÑA NO REGISTRADA (CASO ANOMALO)
            if (loginResult.code === 400 && loginResult.message.includes("Contraseña no registrada. Por favor, establece una.")) {
                 return res.status(400).json({
                    status: "error",
                    code: 400,
                    message: loginResult.message,
                 });
            }

            return res.status(loginResult.code).json({
                status: "error",
                code: loginResult.code,
                message: loginResult.message || "Usuario no registrado."
            });
        }

        const userDataFromDb = loginResult.user_data;

        // 2. COMPARAR LA CONTRASEÑA (MODIFICADO PARA SOPORTAR CARGA MASIVA)
        // =====================================================================
        let isPasswordMatch = false;

        // Verificamos si el correo pertenece a la carga masiva (dominio academiatesla o tesla)
        if (email.includes('academiatesla.com.pe') || email.includes('tesla.com')) {
            // Comparación de TEXTO PLANO (String vs String)
            // Esto permite que '62071612TES' funcione sin estar hasheada
            isPasswordMatch = (password === userDataFromDb.password_hash_db);
        } else {
            // Comparación BCRYPT estándar para usuarios normales
            isPasswordMatch = await bcrypt.compare(password, userDataFromDb.password_hash_db);
        }
        // =====================================================================

        if (!isPasswordMatch) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Usuario o contraseña incorrecta."
            });
        }

        // 3. SI LA CONTRASEÑA ES CORRECTA, CREAR LA SESIÓN Y JWT
        const sessionId = uuidv4();
        const now       = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
        
        const userAgent = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;

        // 4. INSERTAR LA SESIÓN EN LA BASE DE DATOS TABLA `sessions`
        await client.query(
            `INSERT INTO sessions (session_id, usuario_id, user_agent, ip_address, expires_at, last_activity_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [sessionId, userDataFromDb.user_id, userAgent, ipAddress, expiresAt, now]
        );

        // 4. CREAR EL JWT CON EL session_id Y user_id
        const jwtPayload = {
            sessionId: sessionId,
            userId: userDataFromDb.user_id
        };
        const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: `${SESSION_DURATION_HOURS}h` });
        
        // 5. ESTABLECER LA COOKIE DE AUTENTICACIÓN
        res.cookie('authToken', token, {
            httpOnly: true, 
            secure: true,
            sameSite: 'None',
            path: '/',
            maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000
        });

        // 6. ENVIAR RESPUESTA AL CLIENTE
        res.status(200).json({
            status: "success",
            code: 200,
            message: "Login exitoso.",
            user: {
                name: userDataFromDb.name,
                preferences_completed: userDataFromDb.preferences_completed,
                show_phone_question_step: userDataFromDb.show_phone_question_step
            }
        });
    } catch (error) {
        console.error("Error en loginUser:", error);
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor durante el login."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }

}


// =========================================================================
// 2. CONTROLADORES PARA REGISTRO DE DONANTES
// =========================================================================
export const registerDonante = async (req, res) => {
    let client;
    try {
        const { name, lastname, email, password, phone_number } = req.body;

        // 1. VALIDACIONES BÁSICAS DE LOS CAMPOS
        if (!name || !lastname || !email || !password) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Nombre, apellido, email y contraseña son requeridos."
            });
        }
        
        if (password.length < 8) {
             return res.status(400).json({
                status: "error",
                code: 400,
                message: "La contraseña debe tener al menos 8 caracteres."
            });
        }

        // 2. HASHEAR LA CONTRASEÑA
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        client = await getConnection();

        // 3. PREPARAR EL JSON PARA ENVIAR A LA FUNCIÓN PG
        const requestJsonToPg = JSON.stringify({
            name: name,
            lastname: lastname,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            phone_number: phone_number || null
        });

        // 4. LLAMAR A LA FUNCIÓN PG PARA REGISTRO DE DONANTE
        const pgResponse = await client.query('SELECT * FROM api_user_register_local_donante($1)', [requestJsonToPg]);
        const registrationResult = pgResponse.rows[0].api_user_register_local_donante;

        // 5. ENVIO DE RESPUESTA AL CLIENTE
        if (registrationResult.status !== 'success') {
            return res.status(registrationResult.code || 500).json(registrationResult);
        }

        // 6. PARA REGISTRO EXITOSO, ENVÍO DE NOTIFICACIONES DE VERIFICACIÓN (EMAIL Y/O WHATSAPP)
        const userData = registrationResult.user_data;
        const verificationCode = userData?.email_verification_code;

        if (verificationCode) {
            const notificationPromises = [];
            // 6.1. Preparar envío de email si el email existe
            if (userData.email) {
                notificationPromises.push(
                    sendEmailVerificationCode(userData.email, verificationCode)
                        .catch(emailError => console.error("Error de fondo al enviar email de verificación:", emailError))
                );
            }
            /*
            // 6.2. Preparar envío de WhatsApp si el teléfono existe
            if (userData.phone_number) {
                 notificationPromises.push(
                    sendWhatsAppVerificationCode(userData.phone_number, verificationCode)
                        .catch(whatsappError => console.error("Error de fondo al enviar WhatsApp de verificación:", whatsappError))
                );
            }
            */
            // 6.3. Ejecutar envíos en paralelo sin bloquear la respuesta al usuario
            Promise.allSettled(notificationPromises)
                .then(results => console.log('Resultados del envío de notificaciones de registro:', results));
        } else {
            console.warn("Datos del usuario o código de verificación incompletos para enviar notificaciones tras registro:", userData);
        }

        // 7. ENVIAR RESPUESTA AL CLIENTE
        res.status(registrationResult.code || 201).json({
            status: "success",
            message: registrationResult.message,
            data: {
                email: userData.email
            }
        });

    } catch (error) {
        console.error("Error en registerUserLocal:", error);
        // 8. MANEJO DE ERRORES
        if (error.code && error.message && error.status) {
            return res.status(error.code).json(error);
        }
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor durante el registro."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};

// =========================================================================
// 3. CONTROLADORES PARA REGISTRO DE REFUGIOS
// =========================================================================
export const registerRefugio = async (req, res) => {
    let client;
    try {
        const { name, ubicacion, email, password, phone_number } = req.body;

        // 1. VALIDACIONES BÁSICAS DE LOS CAMPOS
        if (!name || !ubicacion || !email || !password) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Nombre, ubicación, email y contraseña son requeridos."
            });
        }
        
        if (password.length < 8) {
             return res.status(400).json({
                status: "error",
                code: 400,
                message: "La contraseña debe tener al menos 8 caracteres."
            });
        }

        // 2. HASHEAR LA CONTRASEÑA
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        client = await getConnection();

        // 3. PREPARAR EL JSON PARA ENVIAR A LA FUNCIÓN PG
        const requestJsonToPg = JSON.stringify({
            name: name,
            ubicacion: ubicacion,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            phone_number: phone_number || null
        });

        // 4. LLAMAR A LA FUNCIÓN PG PARA REGISTRO DE REFUGIO
        const pgResponse = await client.query('SELECT * FROM api_user_register_local_refugios($1)', [requestJsonToPg]);
        const registrationResult = pgResponse.rows[0].api_user_register_local_refugios;

        // 5. ENVIO DE RESPUESTA AL CLIENTE
        if (registrationResult.status !== 'success') {
            return res.status(registrationResult.code || 500).json(registrationResult);
        }

        // 6. PARA REGISTRO EXITOSO, ENVÍO DE NOTIFICACIONES DE VERIFICACIÓN
        const userData = registrationResult.user_data;
        const verificationCode = userData?.email_verification_code;

        if (verificationCode && userData.email) {
            sendEmailVerificationCode(userData.email, verificationCode)
                .catch(emailError => console.error("Error al enviar email de verificación:", emailError));
        }

        // 7. ENVIAR RESPUESTA AL CLIENTE
        res.status(registrationResult.code || 201).json({
            status: "success",
            message: registrationResult.message,
            data: {
                email: userData.email
            }
        });

    } catch (error) {
        console.error("Error en registerRefugio:", error);
        if (error.code && error.message && error.status) {
            return res.status(error.code).json(error);
        }
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor durante el registro."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};

// =========================================================================
// 4. VERIFICACION Y REENVIO DE CODIGO
// =========================================================================
export const verifyEmailAndLogin = async (req, res) => {
    let client;
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Email y código de verificación son requeridos."
            });
        }

        client = await getConnection();
        const requestJsonToPg = JSON.stringify({ email: email.toLowerCase(), code });

        const pgResponse = await client.query('SELECT * FROM api_user_verify_email_code($1)', [requestJsonToPg]);
        const verificationResult = pgResponse.rows[0].api_user_verify_email_code;

        if (verificationResult.status !== 'success') {
            if (verificationResult.code === 409 && verificationResult.user_data) {
                console.log("Email ya estaba verificado, procediendo a loguear al usuario.");
            } else {
                return res.status(verificationResult.code || 400).json(verificationResult);
            }
        }
        const userDataFromDb = verificationResult.user_data;

        // 1. SI EL CÓDIGO ES VÁLIDO, CREAR LA SESIÓN Y JWT
        const sessionId = uuidv4();
        const now       = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
        // const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
        const userAgent = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;

        await client.query(
            `INSERT INTO sessions (session_id, usuario_id, user_agent, ip_address, expires_at, last_activity_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [sessionId, userDataFromDb.user_id, userAgent, ipAddress, expiresAt, now]
        );

        // 2. CREAR EL JWT CON EL session_id Y user_id
        const jwtPayload = {
            sessionId: sessionId,
            userId: userDataFromDb.user_id
        };
        const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: `${SESSION_DURATION_HOURS}h` });
        // const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '15m' });

        // 3. ESTABLECER LA COOKIE DE AUTENTICACIÓN
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: true,     // <--- CAMBIO: Siempre true.
            sameSite: 'None', // <--- CAMBIO.
            path: '/',
            maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000
            
            // maxAge: 15 * 60 * 1000
            // secure: process.env.NODE_ENV === 'production',
            // sameSite: 'Strict',
        });

        // 4. ENVIAR RESPUESTA AL CLIENTE
        res.status(200).json({
            status: "success",
            code: 200,
            message: verificationResult.message,
            user: {
                user_id: userDataFromDb.user_id,
                name: userDataFromDb.name,
                email: userDataFromDb.email,
                preferences_completed: userDataFromDb.preferences_completed,
                show_phone_question_step: userDataFromDb.show_phone_question_step
            }
        });

    } catch (error) {
        console.error("Error en verifyEmailAndLogin:", error);
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor durante la verificación del email."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};

export const resendVerificationCode = async (req, res) => {
    let client;
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Email es requerido para reenviar el código."
            });
        }

        client = await getConnection();
        const requestJsonToPg = JSON.stringify({ email: email.toLowerCase() });

        const pgResponse = await client.query('SELECT * FROM api_user_resend_verification_code($1)', [requestJsonToPg]);
        const resendResult = pgResponse.rows[0].api_user_resend_verification_code;

        if (resendResult.status !== 'success') {
            if (resendResult.code === 200 && resendResult.status === 'info') {
                return res.status(200).json(resendResult);
            }
            return res.status(resendResult.code || 400).json(resendResult);
        }

        // 1. SI LA FUNCIÓN PG FUE EXITOSA, ENVIAR EL NUEVO CÓDIGO DE VERIFICACIÓN
        const emailData = resendResult.data;
        const verificationCode = emailData?.email_verification_code;

        if (verificationCode) {
            const notificationPromises = [];

            // 1.1. Preparar envío de email si el email existe (Reutilizamos la función de envío de email)
            if (emailData.email) {
                notificationPromises.push(
                    sendEmailVerificationCode(emailData.email, verificationCode)
                        .catch(e => console.error("Error de fondo al reenviar email de verificación:", e))
                );
            }
            // 1.2. Preparar envío de WhatsApp si el teléfono existe
            if (emailData.phone_number) {
                notificationPromises.push(
                    sendWhatsAppVerificationCode(emailData.phone_number, verificationCode)
                        .catch(e => console.error("Error de fondo al reenviar WhatsApp de verificación:", e))
                );
            }
            // 1.3. Ejecutar envíos en paralelo sin bloquear la respuesta al usuario
            Promise.allSettled(notificationPromises)
                .then(results => console.log('Resultados del reenvío de notificaciones de verificación:', results));
        } else {
            console.warn("Datos incompletos de la función PG para reenviar notificaciones:", emailData);
        }

        // 2. ENVIAR RESPUESTA AL CLIENTE
        res.status(resendResult.code || 200).json({
            status: "success",
            message: resendResult.message,
            data: {
                email: emailData.email
            }
        });

    } catch (error) {
        console.error("Error en resendVerificationCode:", error);
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor durante el reenvío del código."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};

// =========================================================================
// FIN CONTROLADORES PARA REGISTRO, VERIFICACION Y REENVIO DE USUARIO LOCAL
// =========================================================================


// =============================================================
// 3. CONTROLADORES PARA RESTABLECER CONTRASEÑA DE CUENTA
// =============================================================
export const requestPasswordReset = async (req, res) => {
    let client;
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Email es requerido."
            });
        }

        client = await getConnection();
        const requestJsonToPg = JSON.stringify({ email: email.toLowerCase() });

        const pgResponse = await client.query('SELECT * FROM api_user_request_password_reset($1)', [requestJsonToPg]);
        const result = pgResponse.rows[0].api_user_request_password_reset;

        // 1. MANEJO AJUSTADO DEL RESULTADO DE LA FUNCIÓN PG
        if (result.status === 'error' && result.code === 404) {
            console.log(`Solicitud de restablecimiento para ${email}, pero el email no está registrado (según PG).`);
            
            return res.status(404).json({
                status: "error",
                code: 404,
                message: "El email ingresado, no está registrado"
            });
        }
        
        // 2. MANEJO DE ERRORES DE LA FUNCIÓN PG
        if (result.status !== 'success') {
            return res.status(result.code || 500).json(result);
        }

        // 3. SI LA FUNCIÓN PG FUE EXITOSA, ENVIAR EL CÓDIGO DE RESTABLECIMIENTO
        const { email: userEmail, name: userName, phone_number: userPhoneNumber, password_reset_code: resetCode } = result.data;

        const notificationPromises = [];
        // 3.1. Preparar envío de email si el email existe
        if (userEmail && resetCode) {
            notificationPromises.push(
                sendEmailPasswordResetCode(userEmail, userName, resetCode)
                    .catch(e => console.error("Error de fondo al enviar email de restablecimiento:", e))
            );
        }

        // 3.2. Preparar envío de SMS si el phone number existe
        if (userPhoneNumber && resetCode) {
            notificationPromises.push(
                sendWhatsAppPasswordResetCode(userPhoneNumber, userName, resetCode)
                    .catch(e => console.error("Error de fondo al enviar WhatsApp de restablecimiento:", e))
            );
        }

        // 3.3. Ejecutar envíos en paralelo sin bloquear la respuesta al usuario
        Promise.allSettled(notificationPromises)
            .then(results => console.log('Resultados del envío de notificaciones de restablecimiento:', results));
        

        // 4. RESPUESTA EXITOSA AL CLIENTE
        res.status(200).json({
            status: "success",
            code: 200,
            message: "Si un email esta asociado, se enviará un código para restablecer la contraseña."
        });

    } catch (error) {
        console.error("Error en requestPasswordReset:", error);
        // 5. MANEJO DE ERRORES GENERALES
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor al solicitar restablecimiento de contraseña."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};

export const verifyPasswordResetCode = async (req, res) => {
    let client;
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Email y código de restablecimiento son requeridos."
            });
        }

        client = await getConnection();
        const requestJsonToPg = JSON.stringify({ email: email.toLowerCase(), code });

        const pgResponse = await client.query('SELECT * FROM api_user_verify_password_reset_code($1)', [requestJsonToPg]);
        const result = pgResponse.rows[0].api_user_verify_password_reset_code;

        // 1. MANEJO DE ERRORES DE LA FUNCIÓN PG
        if (result.status !== 'success') {
            return res.status(result.code || 400).json(result);
        }

        // 2. SI EL CÓDIGO ES VÁLIDO, RESPONDER CON ÉXITO
        res.status(200).json({
            status: "success",
            code: 200,
            message: "Código de restablecimiento validado. Ahora puedes establecer una nueva contraseña.",
            data: {
                email: result.data.email
            }
        });

    } catch (error) {
        // 3. MANEJO DE ERRORES GENERALES
        console.error("Error en verifyPasswordResetCode (simplificado):", error);
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor al verificar el código de restablecimiento."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};

export const resetPasswordWithCode = async (req, res) => {
    let client;
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Email, código de restablecimiento y nueva contraseña son requeridos."
            });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "La nueva contraseña debe tener al menos 8 caracteres."
            });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        client = await getConnection();
        const requestJsonToPg = JSON.stringify({
            email: email.toLowerCase(),
            code: code,
            password_hash: passwordHash
        });

        const pgResponse = await client.query('SELECT * FROM api_user_reset_password_with_code($1)', [requestJsonToPg]);
        const result = pgResponse.rows[0].api_user_reset_password_with_code;

        // 1. MANEJO DE ERRORES DE LA FUNCIÓN PG
        if (result.status !== 'success') {
            return res.status(result.code || 400).json(result);
        }

        // 2. SI EL CÓDIGO ES VÁLIDO Y LA CONTRASEÑA SE HA RESTABLECIDO, RESPONDER CON ÉXITO
        res.status(result.code || 200).json({
            status: "success",
            message: result.message
        });

    } catch (error) {
        console.error("Error en resetPasswordWithCode (simplificado):", error);
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor al restablecer la contraseña."
        });
    } finally {
        if (client) {
            releaseConnection(client);
        }
    }
};

// ============================================================= 
// FIN CONTROLADORES PARA RESTABLECER CONTRASEÑA DE CUENTA 
// =============================================================

