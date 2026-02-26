import { Router } from 'express';
import { 
    loginUser, 
    registerDonante,
    registerRefugio, 
    verifyEmailAndLogin, 
    resendVerificationCode,
    requestPasswordReset,
    verifyPasswordResetCode,
    resetPasswordWithCode
} from '../controllers/login_and_register.controllers.js';
import { authenticateToken } from '../auth/auth.js';
import { getUserHeaderData } from '../controllers/main_menu.controllers.js';

const router = Router();

// Ruta de prueba
router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

// Ruta de login de usuario
router.post('/auth/login', loginUser);

// Ruta de registro de donante
router.post('/auth/register/donante', registerDonante);

// Ruta de registro de refugio
router.post('/auth/register/refugio', registerRefugio);

// Ruta de verificación de email y login automático
router.post('/auth/verify-email', verifyEmailAndLogin);

// Ruta de reenvío de código de verificación
router.post('/auth/resend-code', resendVerificationCode);

// Ruta de reenvío de código de verificación
router.post('/auth/forgot-password', requestPasswordReset);
router.post('/auth/verify-password-reset-code', verifyPasswordResetCode);
router.post('/auth/reset-password', resetPasswordWithCode);


// Ruta para obtener los datos de cabecera del usuario
router.get('/user/header-data', authenticateToken, getUserHeaderData);

export default router;
