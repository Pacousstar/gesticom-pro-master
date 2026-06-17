-- CreateTable: CompteCourant
CREATE TABLE IF NOT EXISTS "CompteCourant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL UNIQUE,
    "nom" TEXT NOT NULL,
    "ncc" TEXT,
    "entiteId" INTEGER NOT NULL,
    "clientId" INTEGER UNIQUE,
    "fournisseurId" INTEGER UNIQUE,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompteCourant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompteCourant_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompteCourant_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CompteCourant_entiteId_idx" ON "CompteCourant" ("entiteId");
CREATE INDEX IF NOT EXISTS "CompteCourant_actif_idx" ON "CompteCourant" ("actif");
