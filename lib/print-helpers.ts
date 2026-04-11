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
