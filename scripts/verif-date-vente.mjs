import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

const v = c.prepare("SELECT id, numero, date, createdAt, updatedAt FROM vente WHERE numero = ?").get('V1782473418543');
if (v) {
  console.log('VENTE:');
  console.log('  date:      ' + v.date + ' ms → ' + new Date(v.date).toISOString());
  console.log('  createdAt: ' + v.createdAt + ' ms → ' + (v.createdAt ? new Date(v.createdAt).toISOString() : 'N/A'));
  console.log('  updatedAt: ' + v.updatedAt + ' ms → ' + (v.updatedAt ? new Date(v.updatedAt).toISOString() : 'N/A'));
  console.log('');
  console.log('  Heure locale:');
  console.log('  date:      ' + new Date(v.date).toLocaleString());
  
  // Check the mouvement
  const m = c.prepare("SELECT date, createdAt FROM mouvement WHERE observation LIKE ?").all('%V1782473418543%');
  if (m.length > 0) {
    console.log('\nMOUVEMENT:');
    for (const mvt of m) {
      console.log('  date:      ' + mvt.date + ' ms → ' + new Date(mvt.date).toISOString());
      console.log('  createdAt: ' + (mvt.createdAt || 'N/A') + ' → ' + (mvt.createdAt ? new Date(mvt.createdAt).toISOString() : 'N/A'));
      console.log('  Heure locale: ' + new Date(mvt.date).toLocaleString());
    }
  }
  
  const diffMs = m[0].date - v.date;
  console.log('\nDifférence mouvement - vente: ' + diffMs + ' ms = ' + (diffMs/1000/60/60).toFixed(2) + ' heures');
  
  // Also check if there are other ventes with similar date discrepancy
  console.log('\n--- Autres ventes avec décalage date/mouvement ---');
  const ventesRecentes = c.prepare(`
    SELECT v.id, v.numero, v.date as vDate, m.date as mDate, v.dateOperation
    FROM vente v
    JOIN mouvement m ON m.observation LIKE '%' || v.numero || '%'
    WHERE v.date >= ? AND v.date < ?
    AND ABS(v.date - m.date) > 3600000
    LIMIT 10
  `).all(new Date("2026-06-24").getTime(), new Date("2026-06-28").getTime());
  for (const vt of ventesRecentes) {
    console.log('  ' + vt.numero + ' | vente=' + new Date(vt.vDate).toISOString().slice(0,19) + ' | mvt=' + new Date(vt.mDate).toISOString().slice(0,19) + ' | diff=' + ((vt.mDate - vt.vDate)/3600000).toFixed(1) + 'h');
  }
}

c.close();
