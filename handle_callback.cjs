const http = require('http');
const url = require('url');

console.log('🚀 Starting OAuth callback server on port 1455...');

const server = http.createServer((req, res) => {
  console.log(`📥 Received: ${req.method} ${req.url}`);
  
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/auth/callback' && parsedUrl.query.code) {
    const code = parsedUrl.query.code;
    const state = parsedUrl.query.state;
    
    console.log(`✅ OAuth authorization code received: ${code.substring(0, 15)}...`);
    console.log(`✅ State: ${state.substring(0, 15)}...`);
    
    // Send success response
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(`
      <html><body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: green;">✅ OAuth Authentication Successful!</h2>
        <p>Authorization code has been captured successfully.</p>
        <p><strong>You can now close this browser tab.</strong></p>
        <p>Return to your terminal - Codex should now be authenticated!</p>
        <script>
          console.log('OAuth callback handled successfully');
          setTimeout(() => {
            try { window.close(); } catch(e) { console.log('Could not auto-close tab'); }
          }, 2000);
        </script>
      </body></html>
    `);
    
    console.log('✅ Success response sent to browser');
    
    // Shutdown gracefully after response
    setTimeout(() => {
      console.log('✅ OAuth callback handled successfully - server shutting down');
      server.close(() => {
        process.exit(0);
      });
    }, 1000);
    
  } else {
    // Not the callback we're looking for
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OAuth Callback Server Ready\nWaiting for: /auth/callback?code=...');
    console.log('ℹ️  Server ready, waiting for OAuth callback...');
  }
});

server.listen(1455, 'localhost', () => {
  console.log('🎯 OAuth callback server listening on http://localhost:1455');
  console.log('📋 Ready to handle: /auth/callback');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('💡 Port 1455 is already in use. Kill the process and try again.');
  }
  process.exit(1);
});
