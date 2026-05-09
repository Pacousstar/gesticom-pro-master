-- Migration: add unique constraint on codeBarres in Produit (multi-entité friendly)
-- Contrainte partielle : autorise plusieurs NULL (produits sans code-barres)
CREATE UNIQUE INDEX IF NOT EXISTS "Produit_codeBarres_unique"
ON "Produit"("codeBarres")
WHERE "codeBarres" IS NOT NULL;