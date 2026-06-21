export function isPostgres(): boolean {
  return (process.env.DATABASE_URL ?? '').startsWith('postgresql')
}

export function isSQLite(): boolean {
  return (process.env.DATABASE_URL ?? '').startsWith('file:')
}
