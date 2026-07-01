import Database from 'better-sqlite3';

const nom = 'VERNIS A EAU 1L';
const dev = new Database("C:/gesticom/gesticom.db", { readonly: true });
const saine = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });

const pid_dev = dev.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom).id;
const pid_saine = saine.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom).id;

console.log('Mouvements SAINE:');
const mSaine = saine.prepare("SELECT date, type, quantite, observation FROM Mouvement WHERE produitId = ? ORDER BY date").all(pid_saine);
for (const m of mSaine) {
  console.log(`  ${new Date(m.date).toISOString().slice(0,19)} | ${m.type.padEnd(7)} | ${String(m.quantite).padStart(5)} | ${m.observation?.slice(0,60)}`);
}

console.log('\nMouvements DEV:');
const mDev = dev.prepare("SELECT date, type, quantite, observation FROM Mouvement WHERE produitId = ? ORDER BY date").all(pid_dev);
for (const m of mDev) {
  console.log(`  ${new Date(m.date).toISOString().slice(0,19)} | ${m.type.padEnd(7)} | ${String(m.quantite).padStart(5)} | ${m.observation?.slice(0,60)}`);
}

// Also check if Modif Vente V1780400413371 had a corresponding original Vente mouvement
console.log('\n\nAll mouvements for V1780400413371 in DEV:');
const mRef = dev.prepare("SELECT date, type, quantite, observation FROM Mouvement WHERE observation LIKE '%V1780400413371%'").all();
for (const m of mRef) {
  console.log(`  ${new Date(m.date).toISOString().slice(0,19)} | ${m.type.padEnd(7)} | ${String(m.quantite).padStart(5)} | ${m.observation?.slice(0,60)}`);
}

console.log('\nAll mouvements for V1782379150657 in DEV:');
const mRef2 = dev.prepare("SELECT date, type, quantite, observation FROM Mouvement WHERE observation LIKE '%V1782379150657%'").all();
for (const m of mRef2) {
  console.log(`  ${new Date(m.date).toISOString().slice(0,19)} | ${m.type.padEnd(7)} | ${String(m.quantite).padStart(5)} | ${m.observation?.slice(0,60)}`);
}

dev.close();
saine.close();
