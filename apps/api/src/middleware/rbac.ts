import type { NextFunction, Request, Response } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

/** Blocks access to a resource outside the user's wilayah_scope, unless they're ADMIN. */
export function requireWilayahScope(getResourceWilayah: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (req.user.role === "ADMIN") return next();

    const resourceWilayah = getResourceWilayah(req);
    if (resourceWilayah && req.user.wilayahScope && resourceWilayah !== req.user.wilayahScope) {
      return res.status(403).json({ error: "Forbidden: outside wilayah scope" });
    }
    next();
  };
}
