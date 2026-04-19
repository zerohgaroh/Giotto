const http = require('http');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    http
        .createServer((req, res) => handle(req, res))
        .listen(port, host, () => {
            console.log(`> Ready on http://${host}:${port}`);
        });
});
