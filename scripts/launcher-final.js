/**
 * scripts/launcher-final.js
 * VERSION "GARDE DU CORPS" - AFFICHAGE ABSOLUMENT GARANTI
 * Ce serveur force le service des fichiers CSS (_next/static) et images (public).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const PORT_USER = 3001;      // Le port visible par l'utilisateur
const PORT_INTERNAL = 3002;  // Le port interne utilisé par Next.js Standalone
const APP_DIR = process.cwd();

console.log(`[GestiCom Pro] Démarrage du Launcher "Garde du Corps" dans : ${APP_DIR}`);

// 1. LANCER NEXT.JS STANDALONE EN ARRIERE-PLAN
const standaloneServer = path.join(APP_DIR, 'server.js');
if (!fs.existsSync(standaloneServer)) {
    console.error(`[ERR] Fichier server.js introuvable à : ${standaloneServer}`);
    process.exit(1);
}

const nextEnv = Object.assign({}, process.env, {
    PORT: PORT_INTERNAL.toString(),
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1'
});

const nextProcess = fork(standaloneServer, [], {
    env: nextEnv,
    cwd: APP_DIR,
    stdio: 'inherit'
});

// 2. SERVEUR PROXY + STATIC FORCÉ
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf'
};

const proxyServer = http.createServer((req, res) => {
    const parsedUrl = req.url.split('?')[0];

    // LOGIQUE DE SERVICE STATIQUE PRIORITAIRE
    let filePath = null;

    if (parsedUrl.startsWith('/_next/static/')) {
        // Force la recherche dans .next/static
        const relative = parsedUrl.replace('/_next/static/', '').split('/').join(path.sep);
        filePath = path.join(APP_DIR, '.next', 'static', relative);
    } else if (parsedUrl.startsWith('/public/')) {
        const relative = parsedUrl.replace('/public/', '').split('/').join(path.sep);
        filePath = path.join(APP_DIR, 'public', relative);
    } else if (parsedUrl === '/favicon.ico') {
        filePath = path.join(APP_DIR, 'public', 'favicon.ico');
    }

    // Si on a identifié un fichier statique et qu'il existe physiquement
    if (filePath && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // RELAIS VERS NEXT.JS STANDALONE (Tout ce qui n'est pas statique brut)
    const proxyReq = http.request({
        host: '127.0.0.1',
        port: PORT_INTERNAL,
        path: req.url,
        method: req.method,
        headers: req.headers
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error(`[Proxy Error] Next.js non prêt sur 3002: ${err.message}`);
        res.writeHead(502);
        res.end('<h1>Demarrage de GestiCom Pro...</h1><p>Patientez quelques secondes et rafraichissez (F5).</p>');
    });

    req.pipe(proxyReq, { end: true });
});

proxyServer.listen(PORT_USER, '0.0.0.0', () => {
    console.log(`[Master-Shield] ERP accessible sur http://localhost:${PORT_USER}`);
    console.log(`[Log] Proxy forcant le CSS/Images (3001) -> Next.js Standalone (3002)`);
});

process.on('SIGINT', () => {
    nextProcess.kill();
    process.exit();
});
