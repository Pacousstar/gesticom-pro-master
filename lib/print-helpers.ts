/**
 * Découpe un tableau en plusieurs morceaux (chunks) de tailles potentiellement différentes.
 * Utile pour la première page qui contient un en-tête imposant.
 */
export function paginateArray<T>(array: T[], firstSize: number, otherSize: number): T[][] {
  if (array.length === 0) return [];
  const chunks: T[][] = [];
  
  // Première page
  chunks.push(array.slice(0, firstSize));
  
  // Pages suivantes
  if (array.length > firstSize) {
    for (let i = firstSize; i < array.length; i += otherSize) {
      chunks.push(array.slice(i, i + otherSize));
    }
  }
  
  return chunks;
}

/**
 * Découpe un tableau en plusieurs morceaux (chunks) de taille égale.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (array.length === 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Nombre de lignes par page recommandé pour les rapports avec police 14-15px.
 */
export const ITEMS_PER_PRINT_PAGE = 31;

/**
 * Première page : entête plus haut -> moins de lignes utiles.
 * Ajustable par page si besoin, mais on fixe une valeur sûre par défaut.
 */
export const FIRST_PAGE_ITEMS_PER_PRINT_PAGE = 22

/**
 * Pagination "impression" : distribue les lignes équitablement
 * pour éviter une dernière page trop peu remplie.
 */
export function paginateForPrint<T>(
  array: T[],
  opts?: { firstPageSize?: number; otherPagesSize?: number }
): T[][] {
  const first = Math.max(1, opts?.firstPageSize ?? FIRST_PAGE_ITEMS_PER_PRINT_PAGE)
  const other = Math.max(1, opts?.otherPagesSize ?? ITEMS_PER_PRINT_PAGE)

  if (array.length === 0) return []
  if (array.length <= first) return [array]

  // Découpage standard
  const standard = paginateArray(array, first, other)

  // Si une seule page ou dernière page bien remplie (≥ 60%), on garde
  if (standard.length <= 1) return standard
  const lastSize = standard[standard.length - 1].length
  if (lastSize >= other * 0.6) return standard

  // Répartition équitable sur toutes les pages
  const totalPages = standard.length
  const chunks: T[][] = []
  let pos = 0

  for (let i = 0; i < totalPages; i++) {
    const remaining = array.length - pos
    const pagesLeft = totalPages - i
    const size = Math.ceil(remaining / pagesLeft)
    chunks.push(array.slice(pos, pos + size))
    pos += size
  }

  return chunks
}
