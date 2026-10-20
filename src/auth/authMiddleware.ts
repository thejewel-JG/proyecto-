import { Request, Response, NextFunction } from 'express';
import { getSessionUser, SESSION_COOKIE_NAME, SESSION_DURATION_DAYS, UserSessionData } from './authService';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserSessionData | null;
      sessionToken?: string;
    }
  }
}

export async function attachUserMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const token = cookieToken || bearerToken;

    if (token) {
      const user = await getSessionUser(token);
      req.user = user;
      req.sessionToken = token;
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Autenticación requerida. Por favor, inicie sesión.',
      code: 'UNAUTHORIZED'
    });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Autenticación requerida.',
      code: 'UNAUTHORIZED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado: se requieren permisos de administrador.',
      code: 'FORBIDDEN'
    });
  }
  next();
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
