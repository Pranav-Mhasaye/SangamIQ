// Express middleware for route protection.
// Usage: app.post('/api/alerts', requireAuth('organiser', 'admin'), handler)
// For optional auth (guest allowed): app.post('/api/requests', optionalAuth, handler)

import { verifyAccess } from './jwt.js';

/**
 * Extracts and verifies JWT from Authorization header.
 * Sets req.user = decoded payload if valid, else null.
 */
export function optionalAuth(req, _res, next) {
  req.user = null;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const decoded = verifyAccess(header.slice(7));
    if (decoded) req.user = decoded;
  }
  next();
}

/**
 * Requires a valid JWT with one of the allowed roles.
 * Returns 401 if no token, 403 if wrong role.
 */
export function requireAuth(...roles) {
  return (req, res, next) => {
    // First, extract token
    req.user = null;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const decoded = verifyAccess(header.slice(7));
      if (decoded) req.user = decoded;
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

