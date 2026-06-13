-- CreateTable: SystemAlerte
CREATE TABLE IF NOT EXISTS "SystemAlerte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "categorie" TEXT NOT NULL DEFAULT 'AUTRE',
    "message" TEXT NOT NULL,
    "referenceId" INTEGER,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "entiteId" INTEGER DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SystemAlerte_date_idx" ON "SystemAlerte" ("date");
CREATE INDEX IF NOT EXISTS "SystemAlerte_type_idx" ON "SystemAlerte" ("type");
CREATE INDEX IF NOT EXISTS "SystemAlerte_categorie_idx" ON "SystemAlerte" ("categorie");
CREATE INDEX IF NOT EXISTS "SystemAlerte_lu_idx" ON "SystemAlerte" ("lu");

-- CreateTable: Licence
CREATE TABLE IF NOT EXISTS "Licence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cle" TEXT NOT NULL,
    "clientNom" TEXT,
    "debutValidite" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finValidite" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "features" TEXT NOT NULL DEFAULT '[]',
    "typeEssai" BOOLEAN NOT NULL DEFAULT false,
    "debutEssai" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: Transfert
CREATE TABLE IF NOT EXISTS "Transfert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL UNIQUE,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinOrigineId" INTEGER NOT NULL,
    "magasinDestId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transfert_magasinOrigineId_fkey" FOREIGN KEY ("magasinOrigineId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfert_magasinDestId_fkey" FOREIGN KEY ("magasinDestId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfert_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfert_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Transfert_date_idx" ON "Transfert" ("date");
CREATE INDEX IF NOT EXISTS "Transfert_magasinOrigineId_idx" ON "Transfert" ("magasinOrigineId");
CREATE INDEX IF NOT EXISTS "Transfert_magasinDestId_idx" ON "Transfert" ("magasinDestId");
CREATE INDEX IF NOT EXISTS "Transfert_entiteId_idx" ON "Transfert" ("entiteId");

-- CreateTable: TransfertLigne
CREATE TABLE IF NOT EXISTS "TransfertLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transfertId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransfertLigne_transfertId_fkey" FOREIGN KEY ("transfertId") REFERENCES "Transfert" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransfertLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TransfertLigne_transfertId_idx" ON "TransfertLigne" ("transfertId");

-- CreateTable: Retour
CREATE TABLE IF NOT EXISTS "Retour" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL UNIQUE,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venteId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "montantTotal" REAL NOT NULL,
    "observation" TEXT,
    "estRembourse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Retour_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retour_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retour_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retour_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retour_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Retour_venteId_idx" ON "Retour" ("venteId");
CREATE INDEX IF NOT EXISTS "Retour_clientId_idx" ON "Retour" ("clientId");
CREATE INDEX IF NOT EXISTS "Retour_entiteId_idx" ON "Retour" ("entiteId");
CREATE INDEX IF NOT EXISTS "Retour_magasinId_idx" ON "Retour" ("magasinId");

-- CreateTable: RetourLigne
CREATE TABLE IF NOT EXISTS "RetourLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "retourId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" REAL NOT NULL,
    "prixUnitaire" REAL NOT NULL,
    "tva" REAL NOT NULL DEFAULT 0,
    "remise" REAL NOT NULL DEFAULT 0,
    "montant" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetourLigne_retourId_fkey" FOREIGN KEY ("retourId") REFERENCES "Retour" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetourLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RetourLigne_retourId_idx" ON "RetourLigne" ("retourId");
CREATE INDEX IF NOT EXISTS "RetourLigne_produitId_idx" ON "RetourLigne" ("produitId");

-- CreateTable: ReglementVente
CREATE TABLE IF NOT EXISTS "ReglementVente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant" REAL NOT NULL,
    "modePaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'VALIDE',
    "rapproche" BOOLEAN NOT NULL DEFAULT false,
    "banqueId" INTEGER,
    "venteId" INTEGER,
    "clientId" INTEGER,
    "utilisateurId" INTEGER NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entiteId" INTEGER DEFAULT 1,
    CONSTRAINT "ReglementVente_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES "Banque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReglementVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReglementVente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReglementVente_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReglementVente_date_idx" ON "ReglementVente" ("date");
CREATE INDEX IF NOT EXISTS "ReglementVente_clientId_idx" ON "ReglementVente" ("clientId");
CREATE INDEX IF NOT EXISTS "ReglementVente_venteId_idx" ON "ReglementVente" ("venteId");
CREATE INDEX IF NOT EXISTS "ReglementVente_entiteId_idx" ON "ReglementVente" ("entiteId");
CREATE INDEX IF NOT EXISTS "ReglementVente_modePaiement_idx" ON "ReglementVente" ("modePaiement");
CREATE INDEX IF NOT EXISTS "ReglementVente_rapproche_idx" ON "ReglementVente" ("rapproche");

-- CreateTable: ReglementVenteLigne
CREATE TABLE IF NOT EXISTS "ReglementVenteLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reglementId" INTEGER NOT NULL,
    "venteId" INTEGER NOT NULL,
    "montant" REAL NOT NULL,
    CONSTRAINT "ReglementVenteLigne_reglementId_fkey" FOREIGN KEY ("reglementId") REFERENCES "ReglementVente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReglementVenteLigne_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReglementVenteLigne_reglementId_idx" ON "ReglementVenteLigne" ("reglementId");
CREATE INDEX IF NOT EXISTS "ReglementVenteLigne_venteId_idx" ON "ReglementVenteLigne" ("venteId");

-- CreateTable: ReglementAchat
CREATE TABLE IF NOT EXISTS "ReglementAchat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant" REAL NOT NULL,
    "modePaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'VALIDE',
    "rapproche" BOOLEAN NOT NULL DEFAULT false,
    "achatId" INTEGER,
    "fournisseurId" INTEGER,
    "utilisateurId" INTEGER NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "entiteId" INTEGER DEFAULT 1,
    CONSTRAINT "ReglementAchat_achatId_fkey" FOREIGN KEY ("achatId") REFERENCES "Achat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReglementAchat_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReglementAchat_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReglementAchat_date_idx" ON "ReglementAchat" ("date");
CREATE INDEX IF NOT EXISTS "ReglementAchat_fournisseurId_idx" ON "ReglementAchat" ("fournisseurId");
CREATE INDEX IF NOT EXISTS "ReglementAchat_achatId_idx" ON "ReglementAchat" ("achatId");
CREATE INDEX IF NOT EXISTS "ReglementAchat_entiteId_idx" ON "ReglementAchat" ("entiteId");
CREATE INDEX IF NOT EXISTS "ReglementAchat_modePaiement_idx" ON "ReglementAchat" ("modePaiement");
CREATE INDEX IF NOT EXISTS "ReglementAchat_rapproche_idx" ON "ReglementAchat" ("rapproche");

-- CreateTable: ReglementAchatLigne
CREATE TABLE IF NOT EXISTS "ReglementAchatLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reglementId" INTEGER NOT NULL,
    "achatId" INTEGER NOT NULL,
    "montant" REAL NOT NULL,
    CONSTRAINT "ReglementAchatLigne_reglementId_fkey" FOREIGN KEY ("reglementId") REFERENCES "ReglementAchat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReglementAchatLigne_achatId_fkey" FOREIGN KEY ("achatId") REFERENCES "Achat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReglementAchatLigne_reglementId_idx" ON "ReglementAchatLigne" ("reglementId");
CREATE INDEX IF NOT EXISTS "ReglementAchatLigne_achatId_idx" ON "ReglementAchatLigne" ("achatId");

-- CreateTable: ArchiveVente
CREATE TABLE IF NOT EXISTS "ArchiveVente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numeroFactureOrigine" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "clientLibre" TEXT,
    "montantTotal" REAL NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchiveVente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArchiveVente_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArchiveVente_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArchiveVente_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ArchiveVente_date_idx" ON "ArchiveVente" ("date");
CREATE INDEX IF NOT EXISTS "ArchiveVente_numeroFactureOrigine_idx" ON "ArchiveVente" ("numeroFactureOrigine");
CREATE INDEX IF NOT EXISTS "ArchiveVente_entiteId_idx" ON "ArchiveVente" ("entiteId");
CREATE INDEX IF NOT EXISTS "ArchiveVente_clientId_idx" ON "ArchiveVente" ("clientId");

-- CreateTable: ArchiveVenteLigne
CREATE TABLE IF NOT EXISTS "ArchiveVenteLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venteId" INTEGER NOT NULL,
    "produitId" INTEGER,
    "designation" TEXT NOT NULL,
    "quantite" REAL NOT NULL,
    "prixUnitaire" REAL NOT NULL,
    "montant" REAL NOT NULL,
    CONSTRAINT "ArchiveVenteLigne_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "ArchiveVente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ArchiveSoldeClient
CREATE TABLE IF NOT EXISTS "ArchiveSoldeClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "clientLibre" TEXT,
    "montant" REAL NOT NULL,
    "dateArchive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchiveSoldeClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArchiveSoldeClient_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArchiveSoldeClient_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ArchiveSoldeClient_dateArchive_idx" ON "ArchiveSoldeClient" ("dateArchive");
CREATE INDEX IF NOT EXISTS "ArchiveSoldeClient_entiteId_idx" ON "ArchiveSoldeClient" ("entiteId");
CREATE INDEX IF NOT EXISTS "ArchiveSoldeClient_clientId_idx" ON "ArchiveSoldeClient" ("clientId");

-- CreateTable: CommandeFournisseur
CREATE TABLE IF NOT EXISTS "CommandeFournisseur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL UNIQUE,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fournisseurId" INTEGER,
    "fournisseurLibre" TEXT,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "montantTotal" REAL NOT NULL DEFAULT 0,
    "fraisApproche" REAL NOT NULL DEFAULT 0,
    "observation" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "CommandeFournisseur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommandeFournisseur_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommandeFournisseur_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommandeFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CommandeFournisseur_date_idx" ON "CommandeFournisseur" ("date");
CREATE INDEX IF NOT EXISTS "CommandeFournisseur_entiteId_idx" ON "CommandeFournisseur" ("entiteId");
CREATE INDEX IF NOT EXISTS "CommandeFournisseur_fournisseurId_idx" ON "CommandeFournisseur" ("fournisseurId");
CREATE INDEX IF NOT EXISTS "CommandeFournisseur_magasinId_idx" ON "CommandeFournisseur" ("magasinId");
CREATE INDEX IF NOT EXISTS "CommandeFournisseur_statut_idx" ON "CommandeFournisseur" ("statut");

-- CreateTable: CommandeFournisseurLigne
CREATE TABLE IF NOT EXISTS "CommandeFournisseurLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commandeId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" REAL NOT NULL,
    "prixUnitaire" REAL NOT NULL,
    "tva" REAL NOT NULL DEFAULT 0,
    "remise" REAL NOT NULL DEFAULT 0,
    "montant" REAL NOT NULL,
    CONSTRAINT "CommandeFournisseurLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommandeFournisseurLigne_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CommandeFournisseurLigne_commandeId_idx" ON "CommandeFournisseurLigne" ("commandeId");
