import { describe, it, expect } from 'vitest'
import {
  roundMoneyFCFA,
  htNetLigne,
  montantLigneTTC,
  montantTotalVenteDocument,
  pointsFideliteDepuisEncaissement,
  montantTotalAchatSommeLignes,
  partFraisApprocheLigne,
  nouveauPampApresAchatLigne,
  montantTvaImpliciteLigne,
  htNetDepuisTtcEtTauxGlobal,
  montantTvaDepuisTtcEtHtNet,
  montantHtNetTotalLignesCompta,
} from '../calculs-commerciaux'

describe('roundMoneyFCFA', () => {
  it('arrondit à l\'unité entière', () => {
    expect(roundMoneyFCFA(100.6)).toBe(101)
    expect(roundMoneyFCFA(100.4)).toBe(100)
    expect(roundMoneyFCFA(0)).toBe(0)
  })

  it('gère les valeurs négatives', () => {
    expect(roundMoneyFCFA(-5.7)).toBe(-6)
    expect(roundMoneyFCFA(-5.3)).toBe(-5)
  })

  it('gère NaN et undefined comme 0', () => {
    expect(roundMoneyFCFA(NaN)).toBe(0)
    expect(roundMoneyFCFA(undefined as any)).toBe(0)
    expect(roundMoneyFCFA(null as any)).toBe(0)
  })

  it('gère les grands nombres sans perte de précision', () => {
    expect(roundMoneyFCFA(999999999.9)).toBe(1000000000)
    expect(roundMoneyFCFA(123456789.12)).toBe(123456789)
  })
})

describe('htNetLigne', () => {
  it('calcule le HT net d\'une ligne standard', () => {
    expect(htNetLigne(10, 1500, 0)).toBe(15000)
    expect(htNetLigne(5, 2000, 2500)).toBe(7500)
  })

  it('ne retourne jamais négatif', () => {
    expect(htNetLigne(1, 1000, 5000)).toBe(0)
    expect(htNetLigne(-5, 1000, 0)).toBe(0)
    expect(htNetLigne(5, -1000, 0)).toBe(0)
  })

  it('gère les quantités et prix à zéro', () => {
    expect(htNetLigne(0, 1500, 0)).toBe(0)
    expect(htNetLigne(10, 0, 0)).toBe(0)
    expect(htNetLigne(0, 0, 0)).toBe(0)
  })

  it('clamp la remise négative à 0', () => {
    expect(htNetLigne(10, 1500, -500)).toBe(15000)
  })

  it('gère les grands nombres', () => {
    expect(htNetLigne(1000, 50000, 0)).toBe(50000000)
  })
})

describe('montantLigneTTC', () => {
  it('calcule le TTC avec TVA standard', () => {
    expect(montantLigneTTC({ quantite: 10, prixUnitaire: 1000, remiseLigne: 0, tvaPourcent: 18 })).toBe(11800)
    expect(montantLigneTTC({ quantite: 1, prixUnitaire: 2000, remiseLigne: 500, tvaPourcent: 18 })).toBe(1770)
  })

  it('gère une TVA à 0%', () => {
    expect(montantLigneTTC({ quantite: 5, prixUnitaire: 1000, remiseLigne: 0, tvaPourcent: 0 })).toBe(5000)
  })

  it('clamp la TVA entre 0 et 100%', () => {
    expect(montantLigneTTC({ quantite: 1, prixUnitaire: 1000, remiseLigne: 0, tvaPourcent: -5 })).toBe(1000)
    expect(montantLigneTTC({ quantite: 1, prixUnitaire: 100, remiseLigne: 0, tvaPourcent: 150 })).toBe(200)
  })

  it('arrondit le TTC à l\'unité', () => {
    expect(montantLigneTTC({ quantite: 1, prixUnitaire: 100, remiseLigne: 0, tvaPourcent: 18 })).toBe(118)
  })

  it('gère quantité nulle', () => {
    expect(montantLigneTTC({ quantite: 0, prixUnitaire: 1000, remiseLigne: 0, tvaPourcent: 18 })).toBe(0)
  })
})

describe('montantTotalVenteDocument', () => {
  it('calcule le total avec remise et frais', () => {
    expect(montantTotalVenteDocument(50000, 2000, 1500)).toBe(49500)
  })

  it('ne retourne jamais négatif', () => {
    expect(montantTotalVenteDocument(1000, 5000, 0)).toBe(0)
    expect(montantTotalVenteDocument(0, 0, 0)).toBe(0)
  })

  it('gère remise et frais négatifs en les clampant à 0', () => {
    expect(montantTotalVenteDocument(50000, -1000, 0)).toBe(50000)
    expect(montantTotalVenteDocument(50000, 0, -500)).toBe(50000)
  })
})

describe('pointsFideliteDepuisEncaissement', () => {
  it('calcule 1 point par tranche de 1000 F par défaut', () => {
    expect(pointsFideliteDepuisEncaissement(1000)).toBe(1)
    expect(pointsFideliteDepuisEncaissement(2500)).toBe(2)
    expect(pointsFideliteDepuisEncaissement(999)).toBe(0)
    expect(pointsFideliteDepuisEncaissement(0)).toBe(0)
  })

  it('utilise le taux personnalisé', () => {
    expect(pointsFideliteDepuisEncaissement(5000, 500)).toBe(10)
    expect(pointsFideliteDepuisEncaissement(1000, 2000)).toBe(0)
  })

  it('ne retourne jamais négatif', () => {
    expect(pointsFideliteDepuisEncaissement(-1000)).toBe(0)
    expect(pointsFideliteDepuisEncaissement(-5000, 500)).toBe(0)
  })

  it('retourne 0 si pointsParMillier <= 0', () => {
    expect(pointsFideliteDepuisEncaissement(10000, 0)).toBe(0)
    expect(pointsFideliteDepuisEncaissement(10000, -100)).toBe(0)
  })
})

describe('montantTotalAchatSommeLignes', () => {
  it('additionne les montants TTC des lignes', () => {
    expect(montantTotalAchatSommeLignes([1000, 2000, 3000])).toBe(6000)
  })

  it('gère un tableau vide', () => {
    expect(montantTotalAchatSommeLignes([])).toBe(0)
  })
})

describe('partFraisApprocheLigne', () => {
  it('proratise les frais d\'approche', () => {
    expect(partFraisApprocheLigne(5000, 20000, 2000)).toBe(500)
  })

  it('retourne 0 si la somme HT est <= 0', () => {
    expect(partFraisApprocheLigne(5000, 0, 2000)).toBe(0)
    expect(partFraisApprocheLigne(0, 0, 2000)).toBe(0)
  })
})

describe('nouveauPampApresAchatLigne', () => {
  it('calcule le nouveau PAMP après achat', () => {
    const result = nouveauPampApresAchatLigne({
      stockGlobalAvant: 10,
      pampActuel: 1000,
      quantiteLigne: 5,
      valeurAchatNet: 6000,
      prixUnitaireFallback: 1000,
    })
    expect(result).toBe(1067)
  })

  it('utilise le fallback si nouveau stock = 0', () => {
    const result = nouveauPampApresAchatLigne({
      stockGlobalAvant: 0,
      pampActuel: 0,
      quantiteLigne: 0,
      valeurAchatNet: 0,
      prixUnitaireFallback: 1500,
    })
    expect(result).toBe(1500)
  })
})

describe('montantTvaImpliciteLigne', () => {
  it('calcule la TVA implicite d\'une ligne', () => {
    const tva = montantTvaImpliciteLigne({ quantite: 10, prixUnitaire: 1000, remiseLigne: 0, tvaPourcent: 18 })
    expect(tva).toBe(1800)
  })
})

describe('htNetDepuisTtcEtTauxGlobal', () => {
  it('déduit le HT du TTC avec un taux global', () => {
    expect(htNetDepuisTtcEtTauxGlobal(11800, 18)).toBe(10000)
  })

  it('retourne le TTC si taux = 0%', () => {
    expect(htNetDepuisTtcEtTauxGlobal(5000, 0)).toBe(5000)
  })
})

describe('montantTvaDepuisTtcEtHtNet', () => {
  it('calcule la TVA par différence', () => {
    expect(montantTvaDepuisTtcEtHtNet(11800, 10000)).toBe(1800)
  })

  it('ne retourne jamais négatif', () => {
    expect(montantTvaDepuisTtcEtHtNet(5000, 10000)).toBe(0)
  })
})

describe('montantHtNetTotalLignesCompta', () => {
  it('additionne les HT nets avec remises optionnelles', () => {
    const lignes = [
      { quantite: 10, prixUnitaire: 1000, remise: 0 },
      { quantite: 5, prixUnitaire: 2000, remise: 2500 },
    ]
    expect(montantHtNetTotalLignesCompta(lignes)).toBe(17500)
  })
})
