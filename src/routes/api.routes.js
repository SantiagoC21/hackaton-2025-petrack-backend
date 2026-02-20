import { Router } from 'express';
import { 
    loginUser, 
    registerDonante,
    registerRefugio, 
    verifyEmailAndLogin, 
    resendVerificationCode 
} from '../controllers/login_and_register.controllers.js';

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

export default router;
