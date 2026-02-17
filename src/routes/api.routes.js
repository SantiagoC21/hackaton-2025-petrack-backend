import { Router } from 'express';
import { loginUser } from '../controllers/login_and_register.controllers.js';

const router = Router();

// Ruta de prueba
router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

// Ruta de login de usuario
router.post('/auth/login', loginUser);

export default router;
