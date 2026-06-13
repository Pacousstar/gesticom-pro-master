const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const nssm = path.join(appDir, 'nssm.exe');
const nodeExe = path.join(appDir, 'node.exe');
const launcher = path.join(appDir, 'scripts', 'standalone-launcher.js');
const logDir = path.join(appDir, 'logs');

const logFile = path.join(appDir, 'GestiComService.out');
const errFile = path.join(appDir, 'GestiComService.err');

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [svc-install] ' + msg + '\n'); } catch {}
}
function e(msg) {
  try { fs.appendFileSync(errFile, new Date().toISOString() + ' [svc-install] ' + msg + '\n'); } catch {}
}

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', windowsHide: true, timeout: 15000 });
    return true;
  } catch (err) {
    return false;
  }
}

l('Installation du service GestiCom Pro...');

fs.mkdirSync(logDir, { recursive: true });

l('Arrêt et suppression de l\'ancien service...');
run(`"${nssm}" stop GestiComPro`);
run(`"${nssm}" remove GestiComPro confirm`);

l('Installation du nouveau service...');
const cmds = [
  `"${nssm}" install GestiComPro "${nodeExe}" "${launcher}"`,
  `"${nssm}" set GestiComPro AppDirectory "${appDir}"`,
  `"${nssm}" set GestiComPro AppStdout "${logDir}\\service-out.log"`,
  `"${nssm}" set GestiComPro AppStderr "${logDir}\\service-err.log"`,
  `"${nssm}" set GestiComPro AppRotateFiles 1`,
  `"${nssm}" set GestiComPro AppRotateBytes 10485760`,
  `"${nssm}" set GestiComPro AppExit Default Exit`,
  `"${nssm}" set GestiComPro ObjectName "LocalSystem"`,
  `"${nssm}" set GestiComPro Start SERVICE_DEMAND_START`,
  `"${nssm}" set GestiComPro DisplayName "GestiCom Pro"`,
  `"${nssm}" set GestiComPro Description "ERP commercial GestiCom Pro - Serveur web"`,
  `"${nssm}" set GestiComPro AppNoConsole 1`,
  `"${nssm}" set GestiComPro AppEnvironmentExtra "NODE_ENV=production"`,
];

for (const c of cmds) {
  if (!run(c)) l('  Attention: ' + c);
}

l('Démarrage du service...');
if (!run(`"${nssm}" start GestiComPro`)) {
  e('  Échec démarrage du service');
}
l('Service démarré.');
