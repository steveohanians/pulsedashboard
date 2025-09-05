const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  console.log(`Received: ${req.method} ${req.url}`);
  
  if (parsedUrl.pathname === '/auth/callback') {
    const { code, state } = parsedUrl.query;
    
    if (code) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(`
        <html><body>
          <h2>✅ Authentication Successful!</h2>
          <p>Authorization code: ${code.substring(0, 20)}...</p>
          <p><strong>You can close this tab - authentication complete!</strong></p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body></html>
      `);
      console.log(`✅ OAuth callback received - Code: ${code.substring(0, 20)}...`);
      
      setTimeout(() => {
        console.log('✅ OAuth authentication completed successfully');
        server.close();
        process.exit(0);
      }, 2000);
    } else {
      res.writeHead(400, {'Content-Type': 'text/html'});
      res.end('<html><body><h2>❌ No authorization code received</h2></body></html>');
    }
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OAuth Server Ready - Waiting for /auth/callback');
  }
});

server.listen(1455, () => {
  console.log('🚀 OAuth callback server running on http://localhost:1455');
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});
