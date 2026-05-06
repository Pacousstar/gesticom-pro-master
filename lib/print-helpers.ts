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
export const ITEMS_PER_PRINT_PAGE = 23;

/**
 * Première page : entête plus haut -> moins de lignes utiles.
 * Ajustable par page si besoin, mais on fixe une valeur sûre par défaut.
 */
export const FIRST_PAGE_ITEMS_PER_PRINT_PAGE = 18

/**
 * Pagination "impression" : première page plus courte, suivantes à 23 lignes.
 */
export function paginateForPrint<T>(
  array: T[],
  opts?: { firstPageSize?: number; otherPagesSize?: number }
): T[][] {
  const first = Math.max(1, opts?.firstPageSize ?? FIRST_PAGE_ITEMS_PER_PRINT_PAGE)
  const other = Math.max(1, opts?.otherPagesSize ?? ITEMS_PER_PRINT_PAGE)
  return paginateArray(array, first, other)
}
