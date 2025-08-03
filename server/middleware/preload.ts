import { Express, Request, Response, NextFunction } from 'express';

// Preload critical resources
export function setupPreloading(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' || req.path.startsWith('/dashboard')) {
      // Preload critical resources
      res.set({
        'Link': [
          '</api/user>; rel=preload; as=fetch; crossorigin',
          '</api/filters>; rel=preload; as=fetch; crossorigin',
          '</api/server-boot-time>; rel=preload; as=fetch; crossorigin'
        ].join(', ')
      });
    }
    next();
  });
}