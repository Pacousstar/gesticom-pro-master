import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'downloads.json')

function readCount(): number {
  try {
    if (!fs.existsSync(DATA_FILE)) return 0
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')).count || 0
  } catch { return 0 }
}

function writeCount(n: number) {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify({ count: n }), 'utf-8')
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function GET() {
  const count = readCount()
  return NextResponse.json({ count }, { headers: corsHeaders() })
}

export async function POST() {
  const count = readCount() + 1
  writeCount(count)
  return NextResponse.json({ count }, { headers: corsHeaders() })
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}
