const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/auth/callback') {
    const { code, state } = parsedUrl.query;
    
    if (code) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(`
        <html><body>
          <h2>✅ Authentication Successful!</h2>
          <p>You can close this tab and return to terminal.</p>
          <script>setTimeout(() => window.close(), 2000);</script>
        </body></html>
      `);
      console.log('✅ OAuth authentication completed');
      setTimeout(() => process.exit(0), 1000);
    } else {
      res.writeHead(400, {'Content-Type': 'text/html'});
      res.end('<html><body><h2>❌ Authentication Failed</h2></body></html>');
    }
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Waiting for OAuth callback...');
  }
});

server.listen(1455, () => {
  console.log('🚀 OAuth server ready on http://localhost:1455');
});
