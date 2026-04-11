/**
 * scripts/standalone-launcher.js
 * Version ULTRA-LÉGÈRE : Zéro dépendance native (Supprime better-sqlite3)
 * Indispensable pour le mode standalone sur Windows sans Nginx.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Détection robuste du dossier racine
const findProjectRoot = () => {
    // 1. Essayer le dossier actuel
    if (fs.existsSync(path.join(process.cwd(), '.next'))) return process.cwd();
    // 2. Essayer le dossier parent si on est dans /scripts
    const parentDir = path.dirname(__dirname);
    if (fs.existsSync(path.join(parentDir, '.next'))) return parentDir;
    // 3. Fallback sur le dossier actuel par défaut
    return process.cwd();
};
const projectRoot = findProjectRoot();
console.log(`[Launcher] Dossier racine détecté : ${projectRoot}`);

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

// --- MIGRATION AUTOMATIQUE DE LA BASE DE DONNÉES ---
async function migrateDatabase() {
    console.log('[GestiCom] Vérification des mises à jour de la base de données...');
    const { execSync } = require('child_process');
    
    // Localiser le CLI Prisma (dans node_modules du standalone ou racine)
    let prismaCliPath = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
    if (!fs.existsSync(prismaCliPath)) {
        prismaCliPath = path.join(projectRoot, '.next', 'standalone', 'node_modules', 'prisma', 'build', 'index.js');
    }

    if (fs.existsSync(prismaCliPath)) {
        try {
            console.log('[GestiCom] Analyse et synchronisation de la base de données...');
            // On utilise db push pour garantir que les index de performance sont appliqués 
            // SANS risque de perte de données (--accept-data-loss=false)
            // C'est plus robuste que migrate deploy pour les ajouts d'index simples.
            const cmd = `"${process.execPath}" "${prismaCliPath}" db push --schema="${path.join(projectRoot, 'prisma', 'schema.prisma')}" --accept-data-loss=false`;
            
            execSync(cmd, { 
                env: { ...process.env, DATABASE_URL: `file:${dbPath}`, PRISMA_SKIP_POSTINSTALL_GENERATE: 'true' },
                stdio: 'inherit' 
            });
            console.log('[GestiCom] Base de données et index de performance à jour.');
        } catch (error) {
            console.warn('[GestiCom] Note : La base était probablement déjà synchronisée ou une migration est nécessaire.');
        }
    } else {
        console.warn('[GestiCom] CLI Prisma introuvable. Assurez-vous que l\'installation est complète.');
    }
}

// Lancer la migration avant de démarrer le reste
migrateDatabase().then(() => {
    console.log(`[GestiCom Pro] Prêt à démarrer.`);
});

console.log(`[GestiCom Pro] Base de données : ${dbPath}`);

// --- AUDIT DES FICHIERS STATIQUES (Diagnostic) ---
const cssDir = path.join(projectRoot, '.next', 'static', 'css');
if (fs.existsSync(cssDir)) {
    const files = fs.readdirSync(cssDir);
    console.log(`[Launcher] CSS détectés (${files.length}) : ${files.slice(0, 3).join(', ')}...`);
} else {
    console.warn(`[Launcher] ATTENTION : Dossier CSS introuvable dans ${cssDir}`);
}
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
    const parsedUrl = rawUrl.split('?')[0]; 
    console.log(`[Proxy] ${req.method} ${rawUrl}`);

    // 1. Tenter de servir les fichiers statiques (CSS, JS, Images)
    let filePath = null;
    if (parsedUrl.startsWith('/_next/static/')) {
        const relativePath = parsedUrl.replace('/_next/static/', '');
        // Tentative 1 : Racine du projet (Standard Inno Setup)
        const path1 = path.join(projectRoot, '.next', 'static', relativePath);
        // Tentative 2 : Dans le dossier standalone (Standard Next.js)
        const path2 = path.join(projectRoot, '.next', 'standalone', '.next', 'static', relativePath);
        
        if (fs.existsSync(path1)) filePath = path1;
        else if (fs.existsSync(path2)) filePath = path2;
    } else {
        // Tenter dans public (Favicon, Logo, etc.)
        const fileName = (parsedUrl === '/' || parsedUrl === '') ? 'index.html' : parsedUrl;
        const publicPath = path.join(projectRoot, 'public', fileName);
        if (fs.existsSync(publicPath) && !fs.statSync(publicPath).isDirectory()) {
            filePath = publicPath;
        }
    }

    if (filePath && fs.existsSync(filePath)) {
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        
        fs.readFile(filePath, (error, content) => {
            if (error) {
                console.error(`[Proxy] Erreur 500 sur ${parsedUrl} : ${error.message}`);
                res.writeHead(500);
                res.end('Erreur Interne');
            } else {
                res.writeHead(200, { 
                    'Content-Type': contentType, 
                    'Cache-Control': 'public, max-age=31536000, immutable',
                    'Access-Control-Allow-Origin': '*' 
                });
                res.end(content);
            }
        });
        return;
    } else if (parsedUrl.startsWith('/_next/static/')) {
        console.warn(`[Proxy 404] STATIQUE INTROUVABLE : ${parsedUrl}`);
        console.warn(`   - Tente dans : ${path.join(projectRoot, '.next', 'static', parsedUrl.replace('/_next/static/', ''))}`);
    }

    // 2. Sinon, proxy vers le serveur Next.js
    const proxyReq = http.request({
        host: '127.0.0.1',
        port: NEXT_INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error(`[Proxy Error] 127.0.0.1:${NEXT_INTERNAL_PORT} - ${err.message}`);
        res.writeHead(502);
        res.end('Serveur Next.js en cours de démarrage ou non accessible...');
    });

    req.pipe(proxyReq, { end: true });
});

proxyServer.listen(PORT, HOST, () => {
    console.log(`[GestiCom] Serveur PROXY + STATIC prêt sur http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
    nextProcess.kill();
    process.exit();
});
