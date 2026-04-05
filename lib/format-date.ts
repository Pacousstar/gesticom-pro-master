/**
 * Formate une date de manière déterministe pour éviter les erreurs d'hydratation
 * entre le serveur (Next.js SSR) et le client (navigateur).
 * 
 * Remplace l'utilisation directe de `new Date().toLocaleDateString('fr-FR')`
 * dans le JSX.
 */
export function formatDate(date: string | Date | null | undefined, options?: { includeTime?: boolean }): string {
    if (!date) return '—'

    try {
        const d = typeof date === 'string' ? new Date(date) : date
        // Vérifier si la date est valide
        if (isNaN(d.getTime())) return '—'

        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()

        let res = `${day}/${month}/${year}`

        if (options?.includeTime) {
            const hours = String(d.getHours()).padStart(2, '0')
            const minutes = String(d.getMinutes()).padStart(2, '0')
            res += ` à ${hours}:${minutes}`
        }

        return res
    } catch (e) {
        return '—'
    }
}
