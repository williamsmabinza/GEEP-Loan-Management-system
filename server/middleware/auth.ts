import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtUserPayload } from '../utils/jwt.js';
import { AppError } from './errorHandler.js';
import { UserRole } from '../../shared/types/index.js';
import { roleHasPermission } from '../../shared/constants/roles.js';

// Extend Express Request interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Authorization header with Bearer token is required');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw AppError.unauthorized('Authentication token cannot be blank');
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Role '${req.user.role}' lacks sufficient privileges. Required roles: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}

export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // Super Administrator bypass
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Check permissions array attached to user token, or check matrix
    const userPermissions = req.user.permissions || [];
    const hasPerm = userPermissions.includes(permissionCode) || roleHasPermission(req.user.role, permissionCode);

    if (!hasPerm) {
      return next(
        AppError.forbidden(
          `Access denied. Your role '${req.user.role}' lacks the required permission: '${permissionCode}'`
        )
      );
    }

    next();
  };
}

export function requireAnyPermission(permissionCodes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = permissionCodes.some(
      (code) => userPermissions.includes(code) || roleHasPermission(req.user!.role, code)
    );

    if (!hasAny) {
      return next(
        AppError.forbidden(
          `Access denied. Requires at least one of the following permissions: [${permissionCodes.join(', ')}]`
        )
      );
    }

    next();
  };
}
