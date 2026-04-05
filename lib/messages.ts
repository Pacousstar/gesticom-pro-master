/**
 * Messages utilisateur standardisés (notifications, succès, actions réservées).
 */

export const MESSAGES = {
  // Succès – enregistrement
  ENREGISTREMENT_SUCCES: 'Enregistrement effectué avec succès.',
  VENTE_ENREGISTREE: 'Vente enregistrée avec succès.',
  ACHAT_ENREGISTRE: 'Achat enregistré avec succès.',
  DEPENSE_ENREGISTREE: 'Dépense enregistrée avec succès.',
  CHARGE_ENREGISTREE: 'Charge enregistrée avec succès.',
  CLIENT_ENREGISTRE: 'Client enregistré avec succès.',
  FOURNISSEUR_ENREGISTRE: 'Fournisseur enregistré avec succès.',
  PRODUIT_ENREGISTRE: 'Produit créé avec succès.',
  BANQUE_ENREGISTREE: 'Compte bancaire créé avec succès.',
  OPERATION_BANQUE_ENREGISTREE: 'Opération bancaire enregistrée avec succès.',
  CAISSE_ENREGISTREE: 'Opération caisse enregistrée avec succès.',
  TRANSFERT_ENREGISTRE: 'Transfert enregistré avec succès.',
  ECRITURE_ENREGISTREE: 'Écriture enregistrée avec succès.',
  TEMPLATE_ENREGISTRE: 'Template enregistré avec succès.',
  UTILISATEUR_ENREGISTRE: 'Utilisateur créé avec succès.',
  COMPTE_ENREGISTRE: 'Compte créé avec succès.',
  JOURNAL_ENREGISTRE: 'Journal enregistré avec succès.',

  // Succès – modification
  MODIFICATION_SUCCES: 'Modification effectuée avec succès.',
  VENTE_ANNULEE: 'Vente annulée avec succès.',
  VENTE_SUPPRIMEE: 'Vente supprimée avec succès.',
  ACHAT_SUPPRIME: 'Achat supprimé avec succès.',
  DEPENSE_MODIFIEE: 'Dépense modifiée avec succès.',
  DEPENSE_SUPPRIMEE: 'Dépense supprimée avec succès.',
  CHARGE_MODIFIEE: 'Charge modifiée avec succès.',
  CHARGE_SUPPRIMEE: 'Charge supprimée avec succès.',
  CLIENT_MODIFIE: 'Client modifié avec succès.',
  CLIENT_SUPPRIME: 'Client supprimé avec succès.',
  FOURNISSEUR_MODIFIE: 'Fournisseur modifié avec succès.',
  FOURNISSEUR_SUPPRIME: 'Fournisseur supprimé avec succès.',
  BANQUE_MODIFIEE: 'Compte bancaire modifié avec succès.',
  BANQUE_SUPPRIMEE: 'Compte bancaire supprimé avec succès.',
  OPERATION_BANQUE_SUPPRIMEE: 'Opération bancaire supprimée avec succès.',
  CAISSE_SUPPRIMEE: 'Opération caisse supprimée avec succès.',
  ECRITURE_MODIFIEE: 'Écriture modifiée avec succès.',
  ECRITURE_SUPPRIMEE: 'Écriture supprimée avec succès.',
  TEMPLATE_MODIFIE: 'Template modifié avec succès.',
  TEMPLATE_SUPPRIME: 'Template supprimé avec succès.',
  UTILISATEUR_MODIFIE: 'Utilisateur modifié avec succès.',
  UTILISATEUR_DESACTIVE: 'Utilisateur désactivé avec succès.',
  COMPTE_MODIFIE: 'Compte modifié avec succès.',
  COMPTE_DESACTIVE: 'Compte désactivé avec succès.',
  JOURNAL_DESACTIVE: 'Journal désactivé avec succès.',
  PREFERENCES_SAUVEGARDEES: 'Préférences sauvegardées avec succès.',
  STOCK_MODIFIE: 'Stock modifié avec succès.',
  INVENTAIRE_ENREGISTRE: 'Inventaire enregistré avec succès.',
  MOUVEMENT_SUPPRIME: 'Mouvement supprimé avec succès.',
  SAUVEGARDE_SUPPRIMEE: 'Sauvegarde supprimée avec succès.',
  IMPORT_REUSSI: 'Import réussi.',
  EXPORT_REUSSI: 'Export réussi.',

  // Actions réservées (rôles)
  RESERVE_SUPER_ADMIN: 'Cette action est réservée au Super Administrateur.',
  RESERVE_ADMIN: 'Cette action est réservée à l’administrateur.',
  RESERVE_ADMIN_SUPER_ADMIN: 'Cette action est réservée au Super Administrateur ou à l’administrateur.',
  DROITS_INSUFFISANTS: 'Droits insuffisants pour effectuer cette action.',
} as const

/**
 * Retourne un message d'erreur adapté quand l'API renvoie 403 (action réservée à un rôle).
 */
export function messageErreurRole(res: { status: number; error?: string }): string {
  if (res.status === 403) {
    const msg = (res as { error?: string }).error
    if (msg && (msg.includes('Super') || msg.includes('Administrateur') || msg.includes('réservé') || msg.includes('Droits'))) {
      return msg
    }
    return MESSAGES.DROITS_INSUFFISANTS
  }
  return (res as { error?: string }).error || 'Une erreur est survenue.'
}
