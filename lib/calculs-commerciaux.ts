/**
 * Source unique de vérité pour les calculs commerciaux GestiCom Pro (Vague 2).
 * Montants stockés en FCFA entiers (arrondi à l’unité).
 *
 * Politique d’arrondi :
 * - Chaque ligne : TTC = arrondi((HT ligne − remise ligne) × (1 + TVA%)).
 * - Document vente : total = arrondi(somme TTC lignes − remise globale + frais d’approche), plancher 0.
 * - Document achat (sans remise globale sur en-tête) : total = somme des TTC lignes (déjà arrondis par ligne).
 * - PAMP : valeur d’achat nette = HT net ligne + part frais d’approche (prorata HT net), puis formule PAMP ; arrondi final en entier.
 */

/** Arrondi monétaire standard FCFA (unité entière). */
export function roundMoneyFCFA(value: number): number {
  return Math.round(Number(value) || 0)
}

/** HT net d’une ligne avant TVA (sans arrondi intermédiaire sur le HT brut). */
export function htNetLigne(quantite: number, prixUnitaire: number, remiseLigne: number): number {
  const q = Math.max(0, Number(quantite) || 0)
  const pu = Math.max(0, Number(prixUnitaire) || 0)
  const rem = Math.max(0, Number(remiseLigne) || 0)
  return q * pu - rem
}

/**
 * Montant TTC d’une ligne vente ou achat (même formule).
 * TVA en pourcentage (ex. 18 pour 18 %).
 */
export function montantLigneTTC(input: {
  quantite: number
  prixUnitaire: number
  remiseLigne: number
  tvaPourcent: number
}): number {
  const { quantite, prixUnitaire, remiseLigne, tvaPourcent } = input
  const ht = htNetLigne(quantite, prixUnitaire, remiseLigne)
  const tva = Math.max(0, Number(tvaPourcent) || 0)
  return roundMoneyFCFA(ht * (1 + tva / 100))
}

/** Total document vente après remise globale et frais d’approche. */
export function montantTotalVenteDocument(
  sommeLignesTTC: number,
  remiseGlobale: number,
  fraisApproche: number
): number {
  const sum = Number(sommeLignesTTC) || 0
  const rem = Math.max(0, Number(remiseGlobale) || 0)
  const frais = Math.max(0, Number(fraisApproche) || 0)
  return Math.max(0, roundMoneyFCFA(sum - rem + frais))
}

/** Somme des montants TTC des lignes d’achat (chaque ligne déjà arrondie). */
export function montantTotalAchatSommeLignes(montantsLignesTTC: number[]): number {
  return montantsLignesTTC.reduce((acc, m) => acc + (Number(m) || 0), 0)
}

/** Part des frais d’approche affectée à une ligne (prorata sur HT net facture). */
export function partFraisApprocheLigne(
  htNetLigne: number,
  sommeHtNetFacture: number,
  fraisApprocheTotal: number
): number {
  const ht = Number(htNetLigne) || 0
  const somme = Number(sommeHtNetFacture) || 0
  const frais = Math.max(0, Number(fraisApprocheTotal) || 0)
  if (somme <= 0) return 0
  return (ht / somme) * frais
}

export function valeurAchatNetAvecFrais(htNet: number, partFrais: number): number {
  return (Number(htNet) || 0) + (Number(partFrais) || 0)
}

/**
 * Nouveau PAMP après entrée stock (logique achat création).
 * @param prixUnitaireFallback utilisé si le calcul donne NaN / Infinity
 */
export function nouveauPampApresAchatLigne(input: {
  stockGlobalAvant: number
  pampActuel: number
  quantiteLigne: number
  valeurAchatNet: number
  prixUnitaireFallback: number
}): number {
  const {
    stockGlobalAvant,
    pampActuel,
    quantiteLigne,
    valeurAchatNet,
    prixUnitaireFallback,
  } = input

  const stock = Number(stockGlobalAvant) || 0
  const pamp = Number(pampActuel) || 0
  const q = Math.max(0, Number(quantiteLigne) || 0)
  const val = Number(valeurAchatNet) || 0
  const fallback = Math.max(0, Number(prixUnitaireFallback) || 0)

  let nouveauPamp = pamp
  if (stock <= 0) {
    nouveauPamp = q > 0 ? val / q : pamp
  } else {
    const valeurStockExistant = stock * pamp
    nouveauPamp = (valeurStockExistant + val) / (stock + q)
  }
  if (isNaN(nouveauPamp) || !isFinite(nouveauPamp)) nouveauPamp = fallback
  return roundMoneyFCFA(nouveauPamp)
}

/** Somme des HT nets des lignes (base compta achat/vente HT 701 / 601). */
export function montantHtNetTotalLignesCompta(
  lignes: Array<{ quantite: number; prixUnitaire: number; remise?: number }>
): number {
  return lignes.reduce(
    (sum, l) => sum + htNetLigne(l.quantite, l.prixUnitaire, l.remise ?? 0),
    0
  )
}

/**
 * TVA implicite pour équilibrer TTC document = HT net total lignes + TVA (écritures comptables).
 * Arrondi FCFA ; plancher 0.
 */
export function montantTvaDepuisTtcEtHtNet(montantTTC: number, montantHTNetTotal: number): number {
  const ttc = Number(montantTTC) || 0
  const ht = Number(montantHTNetTotal) || 0
  return Math.max(0, roundMoneyFCFA(ttc - ht))
}

/** HT déduit d’un TTC si aucune ligne (taux TVA global %). */
export function htNetDepuisTtcEtTauxGlobal(montantTTC: number, tvaPourcent: number): number {
  const ttc = Number(montantTTC) || 0
  const t = Math.max(0, Number(tvaPourcent) || 0) / 100
  if (t <= 0) return roundMoneyFCFA(ttc)
  return roundMoneyFCFA(ttc / (1 + t))
}

/** TVA d’affichage par ligne : TTC ligne arrondi − HT net ligne (cohérent facture). */
export function montantTvaImpliciteLigne(input: {
  quantite: number
  prixUnitaire: number
  remiseLigne: number
  tvaPourcent: number
}): number {
  const ttc = montantLigneTTC(input)
  const ht = htNetLigne(input.quantite, input.prixUnitaire, input.remiseLigne)
  return Math.max(0, roundMoneyFCFA(ttc - ht))
}

/** Points fidélité à créditer pour un montant encaissé (FCFA entiers). */
export function pointsFideliteDepuisEncaissement(montant: number): number {
  return Math.floor(Math.max(0, Number(montant) || 0))
}
