import { describe, it, expect } from 'vitest'
import {
  MODES_PAIEMENT,
  STATUTS_PAIEMENT,
  MODES_INSTALLATION,
  LABELS_MODE_INSTALLATION,
  labelModeInstallation,
  normaliserModePaiement,
  estModeBanque,
  estModeCredit,
} from '@/lib/enums-commerce'

describe('MODES_PAIEMENT', () => {
  it('contient les modes essentiels', () => {
    expect(MODES_PAIEMENT).toContain('ESPECES')
    expect(MODES_PAIEMENT).toContain('MOBILE_MONEY')
    expect(MODES_PAIEMENT).toContain('VIREMENT')
    expect(MODES_PAIEMENT).toContain('CHEQUE')
    expect(MODES_PAIEMENT).toContain('CREDIT')
  })
})

describe('STATUTS_PAIEMENT', () => {
  it('contient PAYE', () => {
    expect(STATUTS_PAIEMENT).toContain('PAYE')
  })
})

describe('MODES_INSTALLATION', () => {
  it('contient les 3 modes', () => {
    expect(MODES_INSTALLATION).toEqual(['MODE_1', 'MODE_2', 'MODE_3'])
  })
})

describe('LABELS_MODE_INSTALLATION', () => {
  it('a un libellé pour chaque mode', () => {
    for (const mode of MODES_INSTALLATION) {
      expect(LABELS_MODE_INSTALLATION[mode]).toBeTruthy()
    }
  })
})

describe('labelModeInstallation', () => {
  it('retourne le libellé pour MODE_1', () => {
    expect(labelModeInstallation('MODE_1')).toBe('Poste unique (Local)')
  })

  it('retourne le libellé pour MODE_2', () => {
    expect(labelModeInstallation('MODE_2')).toBe('Réseau (Serveur interne)')
  })

  it('retourne le libellé pour MODE_3', () => {
    expect(labelModeInstallation('MODE_3')).toBe('Migration (MODE_1 → MODE_2)')
  })

  it('retourne la valeur brute pour un mode inconnu', () => {
    expect(labelModeInstallation('INCONNU')).toBe('INCONNU')
  })
})

describe('normaliserModePaiement', () => {
  it('retourne le mode en majuscules', () => {
    expect(normaliserModePaiement('mobile_money')).toBe('MOBILE_MONEY')
    expect(normaliserModePaiement('ESPECES')).toBe('ESPECES')
  })

  it('reconnaît les alias', () => {
    expect(normaliserModePaiement('Cash')).toBe('ESPECES')
    expect(normaliserModePaiement('credit')).toBe('CREDIT')
  })

  it('retourne null pour un mode inconnu', () => {
    expect(normaliserModePaiement('INCONNU')).toBeNull()
  })
})

describe('estModeBanque', () => {
  it('identifie VIREMENT comme mode banque', () => {
    expect(estModeBanque('VIREMENT')).toBe(true)
  })

  it('identifie MOBILE_MONEY comme mode banque', () => {
    expect(estModeBanque('MOBILE_MONEY')).toBe(true)
  })

  it('identifie CHEQUE comme mode banque', () => {
    expect(estModeBanque('CHEQUE')).toBe(true)
  })

  it('identifie ESPECES comme non-banque', () => {
    expect(estModeBanque('ESPECES')).toBe(false)
  })

  it('identifie CREDIT comme non-banque', () => {
    expect(estModeBanque('CREDIT')).toBe(false)
  })
})

describe('estModeCredit', () => {
  it('identifie CREDIT', () => {
    expect(estModeCredit('CREDIT')).toBe(true)
  })

  it('rejette ESPECES', () => {
    expect(estModeCredit('ESPECES')).toBe(false)
  })
})
