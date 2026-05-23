-- Script pour supprimer toutes les ventes et tous les achats
-- À exécuter dans la base de données PostgreSQL

-- Supprimer d'abord les règlements liés aux ventes
DELETE FROM "ReglementVente" WHERE true;

-- Supprimer les lignes de ventes
DELETE FROM "VenteLigne" WHERE true;

-- Supprimer les ventes
DELETE FROM "Vente" WHERE true;

-- Supprimer d'abord les règlements liés aux achats
DELETE FROM "ReglementAchat" WHERE true;

-- Supprimer les lignes d'achats
DELETE FROM "AchatLigne" WHERE true;

-- Supprimer les achats
DELETE FROM "Achat" WHERE true;

-- Vérifier
SELECT 'Ventes restantes:', COUNT(*) FROM "Vente";
SELECT 'Achats restants:', COUNT(*) FROM "Achat";