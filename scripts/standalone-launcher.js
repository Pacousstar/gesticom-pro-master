/**
 * scripts/standalone-launcher.js
 * Version ULTRA-LÉGÈRE : Zéro dépendance native (Supprime better-sqlite3)
 * Indispensable pour le mode standalone sur Windows sans Nginx.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const projectRoot = process.cwd();

// Configuration des variables d'environnement depuis le .env
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value;
        }
    });
}

// --- INITIALISATION BASE DE DONNÉES (DYNAMIQUE) ---
// On tente d'abord un chemin RELATIF au projet pour la portabilité (clé USB, etc.)
const localDbPath = path.join(projectRoot, 'database', 'gesticom.db');
const legacyDbPath = "C:/gesticom/gesticom.db";

let centralDbPath = localDbPath;

// Si le dossier C:/gesticom existe déjà mais pas le local, on peut garder l'ancien par compatibilité
if (!fs.existsSync(path.dirname(localDbPath)) && fs.existsSync(legacyDbPath)) {
    centralDbPath = legacyDbPath;
}

const centralDbDir = path.dirname(centralDbPath);
if (!fs.existsSync(centralDbDir)) {
    console.log(`[Launcher] Création du dossier base : ${centralDbDir}`);
    fs.mkdirSync(centralDbDir, { recursive: true });
}

// Pour forcer Prisma à utiliser le nouveau chemin standard
const dbPath = centralDbPath.replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${dbPath}`;

console.log(`[GestiCom Pro] Base de données : ${dbPath}`);
// ---------------------------------------------------

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

// On cherche le serveur Next.js (server.js)
let serverPath = path.join(projectRoot, 'server.js'); 
if (!fs.existsSync(serverPath)) {
    serverPath = path.join(projectRoot, '.next', 'standalone', 'server.js');
}

if (!fs.existsSync(serverPath)) {
    console.error('Erreur: server.js introuvable (tenté: ' + serverPath + '). Effectuez un "npm run build" d\'abord.');
    process.exit(1);
}

const serverDir = path.dirname(serverPath);
console.log('[Launcher] Serveur détecté dans : ' + serverPath);

// Configuration Next.js
process.env.NODE_ENV = 'production';
process.chdir(serverDir);

const NEXT_INTERNAL_PORT = PORT + 1;
process.env.PORT = NEXT_INTERNAL_PORT.toString();

// Lancement de Next.js en arrière-plan
const { fork } = require('child_process');
const nextProcess = fork(serverPath, [], {
    env: process.env,
    cwd: serverDir,
    stdio: 'inherit'
});

// Serveur Proxy + Static (Servir static et public manuellement car standalone le fait pas bien pour les fichiers statiques)
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
    '.ico': 'image/x-icon'
};

const proxyServer = http.createServer((req, res) => {
    const rawUrl = req.url;
    const parsedUrl = rawUrl.split('?')[0].replace(/\/\//g, '/');
    
    // Journal de bord (En option pour debug)
    // console.log(`[Proxy] ${req.method} ${rawUrl}`);

    // LOGIQUE DE SERVICE STATIQUE (FORCE BRUTE)
    let filePath = null;

    if (parsedUrl.startsWith('/_next/static/')) {
        // Intercepter les styles et scripts internes
        const relativePart = parsedUrl.replace('/_next/static/', '').split('/').join(path.sep);
        filePath = path.join(projectRoot, '.next', 'static', relativePart);
    } else if (parsedUrl === '/favicon.ico' || parsedUrl.startsWith('/public/')) {
        const relativePart = (parsedUrl === '/favicon.ico' ? 'favicon.ico' : parsedUrl.replace('/public/', '')).split('/').join(path.sep);
        filePath = path.join(projectRoot, 'public', relativePart);
    } else {
        // Tenter dans public par défaut pour tout ce qui a une extension (images, fonts)
        const ext = path.extname(parsedUrl);
        if (ext && ext !== '.js' && ext !== '.html') {
             const publicPath = path.join(projectRoot, 'public', parsedUrl.split('/').join(path.sep));
             if (fs.existsSync(publicPath)) filePath = publicPath;
        }
    }

    // Si on a identifié un fichier statique et qu'il existe
    if (filePath && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        
        try {
            const content = fs.readFileSync(filePath);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.writeHead(200);
            res.end(content);
            // console.log(`[OK] ${cleanPath}`);
            return;
        } catch (error) {
            console.error(`[ERR] ${filePath}`, error);
        }
    }

    // RELAIS VERS LE SERVEUR NEXT.JS (APIS ET PAGES)
    const proxyReq = http.request({
        host: '127.0.0.1',
        port: NEXT_INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
    }, (proxyRes) => {
        // Gérer les en-têtes
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error(`[Proxy Error] Next.js non accessible sur port ${NEXT_INTERNAL_PORT} : ${err.message}`);
        res.writeHead(502);
        res.end('<h1>Serveur GestiCom Pro en cours de démarrage...</h1><p>Veuillez rafraîchir la page dans quelques secondes.</p>');
    });

    req.pipe(proxyReq, { end: true });
});

proxyServer.listen(PORT, HOST, () => {
    console.log(`[Master-Shield] GestiCom Pro actif sur http://localhost:${PORT}`);
    console.log(`[Log] Proxy (3001) -> Standalone (3002)`);
});

process.on('SIGINT', () => {
    nextProcess.kill();
    process.exit();
});
