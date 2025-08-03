import compression from 'compression';
import { Express } from 'express';

export function setupCompression(app: Express) {
  // Enable gzip compression for all responses
  app.use(compression({
    level: 6, // Good balance between compression and speed
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      // Don't compress if the response is already compressed
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use compression for text, json, css, js
      return compression.filter(req, res);
    }
  }));
}