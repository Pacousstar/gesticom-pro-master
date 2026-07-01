import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

for (const t of ['AchatLigne', 'VenteLigne', 'RetourLigne', 'RetraitPartielLigne', 'Mouvement']) {
  const cols = c.prepare("PRAGMA table_info('" + t + "')").all();
  console.log(t + ':', cols.map(c => c.name + ' ' + c.type).join(', '));
}
c.close();
