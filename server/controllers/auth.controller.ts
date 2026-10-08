import { Request, Response, NextFunction } from 'express';
import {
  loginUser,
  registerUser,
  getUserById,
  getAllUsers,
  refreshAccessToken,
  logoutUser,
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
  updateUserActivation,
  createUserByAdmin,
  updateUserByAdmin,
} from '../services/auth.service.js';
import {
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateUserStatusInput,
  CreateUserByAdminInput,
} from '../../shared/validators/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as LoginInput;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await loginUser(input, ip, userAgent);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Authentication successful',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as RegisterInput;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await registerUser(input, ip, userAgent);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Account registered successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRefreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshTokenInput;
    const result = await refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Access token refreshed successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user) {
      await logoutUser(req.user.userId);
    }

    res.status(200).json({
      success: true,
      message: 'User session logged out and refresh token revoked',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleChangePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as ChangePasswordInput;
    await changePassword(req.user.userId, input);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Existing sessions have been invalidated.',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleForgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as ForgotPasswordInput;
    const result = await requestPasswordReset(email);

    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleResetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as ResetPasswordInput;
    await resetPasswordWithToken(input);

    res.status(200).json({
      success: true,
      message: 'Password successfully reset. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const user = await getUserById(req.user.userId);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await getAllUsers();
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as UpdateUserStatusInput;
    const updated = await updateUserActivation(req.params.id, input, req.user.userId);

    res.status(200).json({
      success: true,
      data: updated,
      message: `User account status updated to ${input.status}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCreateUserByAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as CreateUserByAdminInput;

    // Prevent privilege escalation: only SUPER_ADMIN can create SUPER_ADMIN accounts
    if (input.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Only Super Administrators can create Super Administrator accounts.');
    }

    const user = await createUserByAdmin(input, req.user.userId);

    res.status(201).json({
      success: true,
      data: user,
      message: 'User account created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateUserByAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as Partial<CreateUserByAdminInput>;

    // Prevent privilege escalation: only SUPER_ADMIN can assign SUPER_ADMIN role
    if (input.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Only Super Administrators can assign the Super Administrator role.');
    }

    const user = await updateUserByAdmin(req.params.id, input, req.user.userId);

    res.status(200).json({
      success: true,
      data: user,
      message: 'User account updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

