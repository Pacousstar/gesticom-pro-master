import path from 'path'
import { getDataDir } from './mode-config'

export async function autoInstallPostgres(): Promise<{
  host: string
  port: number
  database: string
  user: string
  password: string
}> {
  try {
    const _require = eval('require')
    const baseDirForScripts = process.env.GESTICOM_UNPACKED_PATH || process.cwd()
    const pgManager = _require(path.join(baseDirForScripts, 'scripts', 'postgres-manager'))
    const result = await pgManager.ensureAutoPostgres(getDataDir())
    return result.creds
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error('Installation automatique PostgreSQL échouée: ' + msg)
  }
}
