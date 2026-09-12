const http = require('http');

const targetUrl = process.argv[2];
const maxSeconds = Number(process.argv[3] || 40);
const intervalMs = Number(process.argv[4] || 2) * 1000;

if (!targetUrl) {
  console.log('Usage: node healthcheck.js <url> [maxSeconds] [intervalSeconds]');
  process.exit(2);
}

let target;
try {
  const u = new URL(targetUrl);
  target = { hostname: u.hostname, port: Number(u.port || 80), path: u.pathname + u.search };
} catch (e) {
  console.log('Bad URL: ' + targetUrl);
  process.exit(2);
}

function tryOnce() {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: target.hostname,
      port: target.port,
      path: target.path,
      timeout: 3000,
    }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => { req.destroy(); resolve(0); });
    req.on('error', (err) => {
      console.log('  ' + targetUrl + ' -> ' + err.code + ' (' + err.message + ')');
      resolve(0);
    });
  });
}

(async () => {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const code = await tryOnce();
    if (code === 200) {
      console.log('  ' + targetUrl + ' -> OK');
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.log('  TIMED OUT waiting for ' + targetUrl);
  process.exit(1);
})();