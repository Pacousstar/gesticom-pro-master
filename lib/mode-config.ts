import fs from 'fs'
import path from 'path'

export function getDataDir(): string {
  return process.env.GESTICOM_USER_DATA
    || (process.env.APPDATA ? path.join(process.env.APPDATA, 'gesticom-pro') : '')
    || process.cwd()
}

export function readConfigFile(): Record<string, any> {
  try {
    const configPath = path.join(getDataDir(), 'config.json')
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (e) {
    console.error('[mode-config] config.json illisible:', e)
  }
  return {}
}

export function writeConfigFile(data: Record<string, any>) {
  const configPath = path.join(getDataDir(), 'config.json')
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
  } catch (e) {
    console.error('[mode-config] Creation dossier config.json impossible:', e)
  }
  const config = { mode: 'MODE_1', ...readConfigFile(), ...data }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export async function upsertParametreMode(prisma: any, mode: string) {
  const p = await prisma.parametre.findFirst()
  if (!p) {
    await prisma.parametre.create({ data: { modeInstallation: mode } })
  } else {
    await prisma.parametre.update({ where: { id: p.id }, data: { modeInstallation: mode } })
  }
}
