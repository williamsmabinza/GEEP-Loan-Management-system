import { Router } from 'express';
import {
  handleLogin,
  handleRegister,
  handleRefreshToken,
  handleLogout,
  handleChangePassword,
  handleForgotPassword,
  handleResetPassword,
  handleGetMe,
} from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import {
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../../shared/validators/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authRateLimiter.middleware(), validateBody(LoginSchema), handleLogin);
router.post('/register', authRateLimiter.middleware(), validateBody(RegisterSchema), handleRegister);
router.post('/refresh', validateBody(RefreshTokenSchema), handleRefreshToken);
router.post('/logout', requireAuth, handleLogout);
router.post('/change-password', requireAuth, validateBody(ChangePasswordSchema), handleChangePassword);
router.post('/forgot-password', authRateLimiter.middleware(), validateBody(ForgotPasswordSchema), handleForgotPassword);
router.post('/reset-password', authRateLimiter.middleware(), validateBody(ResetPasswordSchema), handleResetPassword);
router.get('/me', requireAuth, handleGetMe);

export default router;
