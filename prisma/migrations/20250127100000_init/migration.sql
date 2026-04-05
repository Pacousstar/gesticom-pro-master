-- CreateTable
CREATE TABLE "Entite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "localisation" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "login" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "motDePasse" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Utilisateur_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Magasin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "localisation" TEXT NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Magasin_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "prixAchat" REAL,
    "prixVente" REAL,
    "seuilMin" INTEGER NOT NULL DEFAULT 5,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "type" TEXT NOT NULL,
    "plafondCredit" REAL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Fournisseur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Parametre" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomEntreprise" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "localisation" TEXT NOT NULL DEFAULT '',
    "devise" TEXT NOT NULL DEFAULT 'FCFA',
    "tvaParDefaut" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produitId" INTEGER NOT NULL,
    "magasinId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "quantiteInitiale" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Stock_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Caisse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "montant" REAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Caisse_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Caisse_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "clientLibre" TEXT,
    "montantTotal" REAL NOT NULL,
    "modePaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'VALIDEE',
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vente_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vente_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vente_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VenteLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venteId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" REAL NOT NULL,
    "montant" REAL NOT NULL,
    CONSTRAINT "VenteLigne_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VenteLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "fournisseurId" INTEGER,
    "fournisseurLibre" TEXT,
    "montantTotal" REAL NOT NULL,
    "modePaiement" TEXT NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achat_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Achat_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Achat_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Achat_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AchatLigne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "achatId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" REAL NOT NULL,
    "montant" REAL NOT NULL,
    CONSTRAINT "AchatLigne_achatId_fkey" FOREIGN KEY ("achatId") REFERENCES "Achat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AchatLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mouvement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "produitId" INTEGER NOT NULL,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mouvement_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mouvement_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mouvement_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mouvement_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "rubrique" TEXT NOT NULL,
    "montant" REAL NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Charge_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Entite_code_key" ON "Entite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_login_key" ON "Utilisateur"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Magasin_code_key" ON "Magasin"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_code_key" ON "Produit"("code");

-- CreateIndex
CREATE INDEX "Produit_designation_idx" ON "Produit"("designation");

-- CreateIndex
CREATE INDEX "Produit_categorie_idx" ON "Produit"("categorie");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_produitId_magasinId_key" ON "Stock"("produitId", "magasinId");

-- CreateIndex
CREATE INDEX "Caisse_date_idx" ON "Caisse"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Vente_numero_key" ON "Vente"("numero");

-- CreateIndex
CREATE INDEX "Vente_date_idx" ON "Vente"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Achat_numero_key" ON "Achat"("numero");

-- CreateIndex
CREATE INDEX "Achat_date_idx" ON "Achat"("date");

-- CreateIndex
CREATE INDEX "Mouvement_date_idx" ON "Mouvement"("date");

-- CreateIndex
CREATE INDEX "Mouvement_type_idx" ON "Mouvement"("type");

-- CreateIndex
CREATE INDEX "Charge_date_idx" ON "Charge"("date");

-- CreateIndex
CREATE INDEX "Charge_type_idx" ON "Charge"("type");
