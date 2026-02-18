import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

// CONFIGURACIÓN DE ULTRAMSG (Idealmente esto iría en process.env)
const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID; 
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN; // Reemplaza con tu token real
const ULTRAMSG_URL = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;

// FUNCIÓN DE RESPALDO: Enviar vía UltraMsg
const sendWhatsAppViaBackup = async (to, body) => {
    try {
        console.log(`⚠️ [Backup Service] Intentando enviar WhatsApp vía UltraMsg a: ${to}`);
        
        const params = new URLSearchParams();
        params.append("token", ULTRAMSG_TOKEN);
        params.append("to", to);
        params.append("body", body);

        const response = await fetchFn(ULTRAMSG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const responseData = await response.text(); // UltraMsg a veces devuelve texto o JSON
        
        if (response.ok) {
            console.log(`✅ [Backup Service] Mensaje enviado exitosamente vía UltraMsg.`);
            return true;
        } else {
            console.error(`❌ [Backup Service] Error en UltraMsg: ${responseData}`);
            return false;
        }
    } catch (error) {
        console.error("❌ [Backup Service] Error crítico al conectar con UltraMsg:", error);
        return false;
    }
};


// =================================================================================
// SECCIÓN 0: CONFIGURACIÓN DE SERVICIOS
// =================================================================================
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, 
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
    },
    tls: {
        rejectUnauthorized: false
    }
});


// =================================================================================
// SECCIÓN 1: FUNCIONES DE BAJO NIVEL (GENÉRICAS - NO EXPORTADAS DIRECTAMENTE)
// =================================================================================

// Función auxiliar para usar 'node-fetch' si es necesario
const fetchFn = async (...args) => {
    if (typeof globalThis.fetch === 'function') {
        return globalThis.fetch(...args);
    }
    const m = await import('node-fetch');
    return m.default(...args);
};

// const serviceUrl = 'http://51.38.243.200:4005/send-message';

export const sendWhatsAppMessage = async (to, body) => {
    // 1. Servicio Principal (Microservicio Local)
    const primaryServiceUrl = 'http://51.38.243.200:4005/send-message';
    let primarySuccess = false;

    try {
        console.log(`--- [API Principal] Intentando enviar WhatsApp a: ${to} ---`);

        const response = await fetchFn(primaryServiceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, body }),
        });

        // Intentamos parsear la respuesta, si falla el JSON, asumimos error
        let responseData = {};
        try { responseData = await response.json(); } catch (e) {}

        if (response.ok && responseData.success) {
            console.log(`✅ [API Principal] Mensaje entregado al servicio local.`);
            primarySuccess = true;
            return true;
        } else {
            console.warn(`⚠️ [API Principal] Falló el envío. Razón: ${responseData.message || 'Desconocida'}`);
        }
    } catch (error) {
        console.warn("⚠️ [API Principal] Error de conexión con el servicio local.", error.message);
    }

    // 2. Servicio de Respaldo (UltraMsg) - Solo si el primero falló
    if (!primarySuccess) {
        console.log(`🔄 Activando servicio de respaldo para: ${to}...`);
        return await sendWhatsAppViaBackup(to, body);
    }
};

const sendEmail = async (to, subject, htmlBody) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: to,
        subject: subject,
        html: htmlBody,
    };

    try {
        console.log(`--- Preparando para enviar email REAL a: ${to} ---`);
        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Email real enviado exitosamente a: ${to}. Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error("❌ Error al enviar el email real:", error);
        return false;
    }
};



// =================================================================================
// SECCIÓN 2: FUNCIONES DE ALTO NIVEL (ESPECÍFICAS - EXPORTADAS)
// =================================================================================

const createEmailTemplate = (title, contentHtml) => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        /* Importamos una fuente amigable y moderna */
        @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700&display=swap');

        /* Estilos generales */
        body {
        margin: 0;
        padding: 0;
        font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: #f4f4f8; /* Fondo gris claro suave */
        color: #333333;
        }

        /* Contenedor principal */
        .container {
        width: 100%;
        max-width: 600px; /* Ancho máximo para una buena lectura */
        margin: 20px auto; /* Centrado horizontal con margen superior */
        background-color: #ffffff;
        border-radius: 12px; /* Bordes redondeados para un aspecto moderno */
        overflow: hidden; /* Asegura que el contenido no se desborde */
        box-shadow: 0 4px 15px rgba(0,0,0,0.08); /* Sombra suave para dar profundidad */
        }

        /* Imagen de cabecera temática */
        .header-image {
        width: 100%;
        height: auto;
        display: block; /* Elimina espacios extra debajo de la imagen */
        border-bottom: 4px solid #FFB347; /* Borde naranja cálido de Petrack */
        }

        /* Área de contenido principal */
        .content-padding {
        padding: 40px;
        }

        /* Título principal */
        h1 {
        margin: 0 0 25px 0;
        color: #2c3e50; /* Azul oscuro profesional */
        font-size: 28px;
        font-weight: 700;
        line-height: 1.3;
        }

        /* Cuerpo del texto */
        .content-body {
        font-size: 16px;
        line-height: 1.6;
        color: #555555;
        }
        .content-body p {
        margin-bottom: 20px;
        }

        /* Elemento visual de confianza (Blockchain) */
        .trust-badge {
        display: inline-flex;
        align-items: center;
        background-color: #e8f5e9; /* Verde claro de confianza */
        color: #2e7d32; /* Verde más oscuro */
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 30px;
        }
        .trust-badge svg {
        margin-right: 8px;
        }

        /* Pie de página */
        .footer {
        padding: 30px;
        background-color: #2c3e50; /* Azul oscuro para el footer */
        color: #ffffff;
        text-align: center;
        font-size: 14px;
        }
        .footer p {
        margin: 5px 0;
        opacity: 0.8; /* Un poco más claro */
        }
        .footer strong {
        color: #FFB347; /* Naranja de Petrack para el nombre */
        font-size: 16px;
        }

        /* Responsive para móviles */
        @media screen and (max-width: 600px) {
        .container {
            width: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
        }
        .content-padding {
            padding: 30px 20px !important;
        }
        h1 {
            font-size: 24px !important;
        }
        }
    </style>
    </head>
    <body>
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
        <td align="center">
            
            <table class="container" border="0" cellpadding="0" cellspacing="0">
            
            <tr>
                <td>
                    <img src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=600&h=200" 
                        alt="Petrack Cat Header" 
                        style="width: 100%; height: auto; display: block; border-bottom: 4px solid #FFB347;">
                </td>
            </tr>

            <tr>
                <td class="content-padding">
                <div class="trust-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    </svg>
                    Verificado por Blockchain
                </div>

                <h1>${title}</h1>

                <div class="content-body">
                    ${contentHtml}
                    
                    <p style="margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                    Gracias por ser parte de esta comunidad que transforma vidas, una donación transparente a la vez. 🐾
                    </p>
                </div>
                </td>
            </tr>

            <tr>
                <td class="footer">
                <p><strong>Petrack</strong> | Transparencia para el Bienestar Animal</p>
                <p>&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
                <p style="font-size: 12px; margin-top: 15px;">
                    Estás recibiendo este correo porque eres parte de la comunidad Petrack. 
                    <br><a href="#" style="color: #FFB347; text-decoration: underline;">Preferencias de comunicación</a>.
                </p>
                </td>
            </tr>
            </table>

        </td>
        </tr>
    </table>
    </body>
    </html>
  `;
};

// --- Notificaciones para Verificación de Cuenta ---
export const sendEmailVerificationCode = async (toEmail, verificationCode) => {
  const subject = `Tu código de verificación para Petrack`;
  const content = ` 
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifica tu cuenta - Petrack</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700&display=swap');
        
        body {
        margin: 0; padding: 0;
        font-family: 'Nunito Sans', Arial, sans-serif;
        background-color: #f4f7f6;
        color: #333333;
        }

        /* Estilos del contenedor de código */
        .code-box {
        background-color: #fff9f2; /* Fondo naranja muy suave */
        border: 2px dashed #FFB347; /* Borde punteado estilo cupón/seguridad */
        border-radius: 12px;
        text-align: center;
        padding: 30px;
        margin: 30px 0;
        }

        .verification-code {
        font-size: 42px;
        font-weight: 800;
        color: #2c3e50;
        letter-spacing: 8px;
        text-shadow: 1px 1px 0px #ffffff;
        }

        @media screen and (max-width: 600px) {
        .container { width: 100% !important; border-radius: 0 !important; }
        .verification-code { font-size: 32px !important; letter-spacing: 5px !important; }
        }
    </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f7f6;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
        <td align="center" style="padding: 20px 10px;">
            
            <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            
            <tr>
                <td>
                <img src="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=600&h=200" 
                    alt="Petrack Header" 
                    style="width: 100%; height: auto; display: block; border-bottom: 4px solid #FFB347;">
                </td>
            </tr>

            <tr>
                <td style="padding: 40px;">
                <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 24px;">¡Hola, ${toEmail}! 🐾</h2>
                
                <p style="margin: 0 0 10px 0; font-size: 16px; color: #555555; line-height: 1.5;">
                    Estás a un paso de ayudar a cientos de refugios con la transparencia de la tecnología <strong>Blockchain</strong>. 
                </p>
                <p style="margin: 0; font-size: 16px; color: #555555;">
                    Para verificar tu cuenta, ingresa el siguiente código en la aplicación:
                </p>

                <div class="code-box">
                    <span class="verification-code">${verificationCode}</span>
                </div>

                <p style="margin: 0 0 10px 0; font-size: 13px; color: #999999; text-align: center;">
                    Este código expirará en <strong>15 minutos</strong> por razones de seguridad.
                </p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 14px; color: #777777;">
                    Si no solicitaste este código, puedes ignorar este correo con total tranquilidad. Alguien podría haber escrito tu dirección por error.
                </div>
                </td>
            </tr>

            <tr>
                <td align="center" style="padding: 30px; background-color: #2c3e50; color: #ffffff;">
                <p style="margin: 0; font-size: 14px; font-weight: bold;">by Petrack</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
                    Seguridad descentralizada para el bienestar animal.<br>
                    &copy; ${new Date().getFullYear()}
                </p>
                </td>
            </tr>
            </table>

        </td>
        </tr>
    </table>
    </body>
    </html>
  `;
  const body = createEmailTemplate('Verifica tu cuenta', content);
  return await sendEmail(toEmail, subject, body);
};

export const sendWhatsAppVerificationCode = async (phoneNumber, verificationCode) => {
    const messageBody = `¡Hola! 👋 Tu nuevo código de verificación para *AdmisionAPP* es: *${verificationCode}*\n\nEste código expirará en 15 minutos. 🚀`;
    return await sendWhatsAppMessage(phoneNumber, messageBody);
};

// --- Notificaciones para Restablecimiento de Contraseña ---
export const sendEmailPasswordResetCode = async (toEmail, userName, resetCode) => {
  const subject = `Restablece tu contraseña de Petrack`;

  // Definimos el HTML completo con el diseño de Petrack
  const fullHtmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña - Petrack</title>
  <style>
    /* Importamos la misma fuente */
    @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700;800&display=swap');
    
    body {
      margin: 0; padding: 0;
      font-family: 'Nunito Sans', Arial, sans-serif;
      background-color: #f4f7f6;
      color: #333333;
    }

    /* ESTILO CLAVE: El mismo cuadro de código del diseño anterior */
    .code-box {
      background-color: #fff9f2; /* Fondo naranja muy suave */
      border: 2px dashed #FFB347; /* Borde punteado estilo cupón/seguridad */
      border-radius: 12px;
      text-align: center;
      padding: 30px;
      margin: 30px 0;
    }

    .reset-code-text {
      font-size: 42px;
      font-weight: 800;
      color: #2c3e50; /* Azul oscuro */
      letter-spacing: 8px;
      font-family: ' Courier New', Courier, monospace; /* Monospace para evitar confusión entre O y 0 */
    }

    /* Estilos Responsivos */
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 30px 20px !important; }
      .reset-code-text { font-size: 32px !important; letter-spacing: 5px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7f6;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        
        <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          
          <tr>
            <td>
                <img src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=600&h=200" 
                    alt="Petrack Cat Header" 
                    style="width: 100%; height: auto; display: block; border-bottom: 4px solid #FFB347;">
            </td>
          </tr>

          <tr>
            <td class="content-padding" style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 24px;">¿Necesitas recuperar tu acceso, ${userName}? 🐾</h2>
              
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #555555; line-height: 1.5;">
                No hay problema. Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Petrack</strong>.
              </p>
              <p style="margin: 0; font-size: 16px; color: #555555;">
                Usa el siguiente código de seguridad para volver a entrar:
              </p>

              <div class="code-box">
                <span class="reset-code-text">${resetCode}</span>
              </div>

              <p style="margin: 0 0 10px 0; font-size: 13px; color: #999999; text-align: center;">
                Este código de seguridad expirará en <strong>15 minutos</strong>.
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 14px; color: #777777; line-height: 1.4;">
                Si TÚ NO solicitaste este cambio, por favor ignora este mensaje. Tu cuenta sigue estando segura y no se han realizado cambios.
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 30px; background-color: #2c3e50; color: #ffffff;">
              <p style="margin: 0; font-size: 14px; font-weight: bold;">Petrack by WMA SYSTEMS</p>
              <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
                Seguridad descentralizada para el bienestar animal.<br>
                &copy; ${new Date().getFullYear()}
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // Nota: Como ya estamos inyectando el HTML completo (incluyendo head y body),
  // ya no necesitamos llamar a `createEmailTemplate` si esa función solo envolvía contenido.
  // Enviamos el HTML completo directamente.
  return await sendEmail(toEmail, subject, fullHtmlContent);
};

export const sendWhatsAppPasswordResetCode = async (phoneNumber, userName, resetCode) => {
    const messageBody = `👋 Hola ${userName},\n\n🔐 Tu código para restablecer la contraseña en *AdmisionAPP* es: *${resetCode}*\n\n❗ Si no lo solicitaste, puedes ignorar este mensaje.`;
    return await sendWhatsAppMessage(phoneNumber, messageBody);
};

// --- Notificaciones para Establecer Contraseña de Cuenta Social ---
export const sendEmailSetSocialPasswordCode = async (toEmail, userName, setCode) => {
  const subject = `Crea tu contraseña para tu cuenta de AdmisionAPP`;
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #e5e5e7;">¡Hola ${userName}! 👋</p>
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #e5e5e7;">Para que también puedas iniciar sesión con tu email, aquí tienes tu código para crear una contraseña en <strong>AdmisionAPP</strong>:</p>
    <div style="background-color: #1c1c1e; border: 1px solid #3a3a3c; border-radius: 5px; text-align: center; padding: 20px; margin: 20px 0;">
      <span style="font-size: 36px; font-weight: bold; color: #87CEFA; letter-spacing: 5px;">${setCode}</span>
    </div>
    <p style="margin: 0; font-size: 14px; color: #8e8e93;">Este código expirará en 15 minutos. 🔐</p>
  `;
  const body = createEmailTemplate('Crea tu Contraseña', content);
  return await sendEmail(toEmail, subject, body);
};

export const sendWhatsAppSetSocialPasswordCode = async (phoneNumber, userName, setCode) => {
    const messageBody = `¡Hola ${userName}! 🤝\n\nPara que también puedas iniciar sesión con tu email, aquí tienes tu código para crear una contraseña en *AdmisionAPP*:\n\n*${setCode}*\n\n¡Este código expirará en 15 minutos.! 🔐`;
    return await sendWhatsAppMessage(phoneNumber, messageBody);
};


// --- Notificación para Instrucciones de Pago ---
export const sendWhatsAppPaymentInstruction = async (phoneNumber, userName) => {
  const messageBody = `¡Hola ${userName}! 👋\n\nNotamos que estás iniciando un pago para activar tu cuenta en *AdmisionAPP*. ¡Excelente decisión! 🚀\n\nPara completar el proceso, por favor, envía tu comprobante de pago a través de este mismo chat. Estaremos atentos para activar tu cuenta lo antes posible.✅`;
  return await sendWhatsAppMessage(phoneNumber, messageBody);
};


// --- Notificación Interna para Administradores ---
export const sendWhatsAppAdminNotification = async (messageBody) => {
  const adminPhoneNumber = process.env.ADMIN_WHATSAPP_NUMBER;

  if (!adminPhoneNumber) {
      console.error("El número de WhatsApp del administrador (ADMIN_WHATSAPP_NUMBER) no está configurado en .env");
      return false;
  }
  return await sendWhatsAppMessage(adminPhoneNumber, messageBody);
};


// --- Notificación de Bienvenida al Completar Preferencias ---
export const sendWelcomeWhatsAppMessage = async (phoneNumber, userName) => {
  const messageBody = `¡Bienvenido/a a bordo, ${userName}! 🚀\n\nEstamos emocionados de tenerte en *AdmisionAPP*. Has tomado el primer gran paso hacia tu ingreso a la universidad.\n\nAquí tienes un vistazo rápido de las herramientas que te esperan:\n\n✅ *Soporte de Docentes 24/7:*\n¿Atascado/a en un problema? Envía tu consulta desde la app y recibe ayuda de expertos.\n\n🎯 *Planes de Estudio a tu Medida:*\nElige tu universidad y nosotros te damos la ruta de estudio optimizada para tu ingreso.\n\n📊 *Reportes de Progreso Inteligentes:*\nDescubre tus fortalezas y debilidades para estudiar de forma más eficiente.\n\n🧠 *Quizzes y Prácticas Ilimitadas:*\nPon a prueba tus conocimientos al final de cada tema y refuerza lo aprendido.\n\n¡Tu camino hacia la universidad empieza ahora! Explora tu plan de estudio y da el primer paso. 💪`;
  return await sendWhatsAppMessage(phoneNumber, messageBody);
};