import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const dataDir = process.env.GESTICOM_USER_DATA || process.cwd()
  const configPath = path.join(dataDir, 'config.json')
  const configured = fs.existsSync(configPath)
  return NextResponse.json({ configured })
}
