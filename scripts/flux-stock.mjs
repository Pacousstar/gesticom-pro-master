import Database from 'better-sqlite3';

const codes = ['ETB-00152', 'ETB-00264'];
const stocksSaine = { 'ETB-00152': 579, 'ETB-00264': 577 };
const debut = new Date('2026-06-11').getTime();
const fin = new Date('2026-06-28').getTime(); // include up to 27/06

const db = new Database('C:/gesticom/gesticom.db', { readonly: true });

for (const code of codes) {
  const prod = db.prepare("SELECT id, designation FROM produit WHERE code = ?").get(code);
  if (!prod) continue;

  const stockInitial = stocksSaine[code];
  const stockActuel = db.prepare("SELECT quantite FROM stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1").get(prod.id);
  const stockFinal = stockActuel ? stockActuel.quantite : 0;

  console.log('='.repeat(70));
  console.log(`${code} ${prod.designation.trim()}`);
  console.log(`Stock initial (base saine 11/06): ${stockInitial}`);
  console.log(`Stock final   (base actuelle 27/06): ${stockFinal}`);
  console.log(`Écart: ${stockFinal - stockInitial}`);
  console.log('');

  // All movements from 11/06 to 27/06
  const mvts = db.prepare(`
    SELECT m.date, m.type, m.quantite, m.observation,
      CASE
        WHEN m.observation LIKE 'Vente V%' THEN 'VENTE'
        WHEN m.observation LIKE 'Modif Vente V%' THEN 'MODIF_VENTE'
        WHEN m.observation LIKE 'Livraison commande V%' THEN 'LIVRAISON_CMD'
        WHEN m.observation LIKE 'Retrait vente V%' THEN 'RETRAIT'
        WHEN m.observation LIKE 'Achat A%' THEN 'ACHAT'
        WHEN m.observation LIKE 'Retour client%' THEN 'RETOUR'
        WHEN m.observation LIKE 'Ajustement%' THEN 'AJUSTEMENT'
        WHEN m.observation LIKE 'Modif Achat A%' THEN 'MODIF_ACHAT'
        ELSE 'AUTRE'
      END as categorie
    FROM mouvement m
    WHERE m.produitId = ? AND m.entiteId = 1
      AND m.date >= ? AND m.date < ?
    ORDER BY m.date ASC, m.id ASC
  `).all(prod.id, debut, fin);

  // Group by date
  let running = stockInitial;
  let currentDate = '';
  let dateLines = [];
  let dayDelta = 0;

  for (const m of mvts) {
    const d = new Date(m.date).toISOString().slice(0, 10);
    const h = new Date(m.date).toISOString().slice(11, 16);
    const qte = m.type === 'ENTREE' ? m.quantite : -m.quantite;

    if (d !== currentDate && currentDate !== '') {
      // Print previous day summary
      console.log(`${currentDate} | stock début=${running - dayDelta} | ${dateLines.join(', ')} | stock fin=${running}`);
      dateLines = [];
    }

    if (d !== currentDate) {
      currentDate = d;
      dayDelta = 0;
    }

    running += qte;
    dayDelta += qte;
    
    let label = m.categorie;
    if (label === 'VENTE') label = 'Vte';
    else if (label === 'MODIF_VENTE') label = 'Modif';
    else if (label === 'LIVRAISON_CMD') label = 'Livraison';
    else if (label === 'RETRAIT') label = 'Retrait';
    else if (label === 'ACHAT') label = 'Achat';
    else if (label === 'RETOUR') label = 'Retour';
    else if (label === 'AJUSTEMENT') label = 'Ajust';
    else if (label === 'MODIF_ACHAT') label = 'ModifAchat';

    dateLines.push(`${label}${qte > 0 ? '+' : ''}${qte}`);
  }

  // Print last day
  if (currentDate) {
    console.log(`${currentDate} | stock début=${running - dayDelta} | ${dateLines.join(', ')} | stock fin=${running}`);
  }

  console.log('');
  console.log('RÉCAPITULATIF:');
  const recap = { VENTE: 0, MODIF_VENTE: 0, LIVRAISON_CMD: 0, RETRAIT: 0, ACHAT: 0, RETOUR: 0, AJUSTEMENT: 0, MODIF_ACHAT: 0, AUTRE: 0 };
  for (const m of mvts) {
    const qte = m.type === 'ENTREE' ? m.quantite : -m.quantite;
    recap[m.categorie] += qte;
  }
  for (const [cat, qte] of Object.entries(recap)) {
    if (qte !== 0) {
      console.log(`  ${cat.padEnd(15)} ${qte > 0 ? '+' : ''}${qte}`);
    }
  }
  console.log(`  TOTAL net: ${stockFinal - stockInitial}`);
  console.log('');
}

db.close();
