/**
 * scripts/scheduled-backup.js
 * Planificateur de sauvegardes automatiques via node-cron.
 * Execute la sauvegarde selon une frequence definie dans .env (BACKUP_FREQUENCE).
 * Frequences supportees : daily, weekly, monthly
 * Heure par defaut : 03:00 du matin (BACKUP_HOUR=3, BACKUP_MINUTE=0)
 *
 * Usage : node scripts/scheduled-backup.js
 * Integration : appele par standalone-launcher.js en tache de fond.
 */

const path = require('path')
const fs = require('fs')
const { fork } = require('child_process')

const logFile = path.resolve(__dirname, '..', 'GestiComService.out')

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [scheduler] ' + msg + '\n') } catch {}
}

function runBackup(callback) {
  l('Execution de la sauvegarde planifiee...')
  const child = fork(path.resolve(__dirname, 'sauvegarde-bd.js'), [], {
    stdio: 'pipe',
    env: process.env,
    windowsHide: true,
    cwd: path.resolve(__dirname, '..'),
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (d) => { stdout += d.toString() })
  child.stderr.on('data', (d) => { stderr += d.toString() })

  child.on('close', (code) => {
    if (code === 0) {
      l('Sauvegarde planifiee reussie: ' + stdout.trim())
    } else {
      l('ERREUR sauvegarde planifiee (code ' + code + '): ' + (stderr || stdout).trim())
    }
    if (callback) callback(code === 0)
  })
}

function startScheduler() {
  let cron
  try {
    cron = require('node-cron')
  } catch {
    l('node-cron non disponible, planification desactivee')
    return
  }

  const frequence = (process.env.BACKUP_FREQUENCE || 'daily').toLowerCase()
  const hour = parseInt(process.env.BACKUP_HOUR || '3', 10)
  const minute = parseInt(process.env.BACKUP_MINUTE || '0', 10)

  let cronExpr
  switch (frequence) {
    case 'hourly':
      cronExpr = `${minute} * * * *`
      break
    case 'daily':
      cronExpr = `${minute} ${hour} * * *`
      break
    case 'weekly':
      cronExpr = `${minute} ${hour} * * 0`
      break
    case 'monthly':
      cronExpr = `${minute} ${hour} 1 * *`
      break
    default:
      l('Frequence inconnue: ' + frequence + ', utilisation daily')
      cronExpr = `${minute} ${hour} * * *`
  }

  l('Planificateur demarre: ' + frequence + ' (' + cronExpr + ')')

  cron.schedule(cronExpr, () => {
    l('Declenchement planifie...')
    runBackup()
  })

  runBackup((ok) => {
    l('Premiere sauvegarde ' + (ok ? 'reussie' : 'echouee'))
  })
}

if (require.main === module) {
  startScheduler()
}

module.exports = { startScheduler, runBackup }
