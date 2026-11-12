import products from '../data/instagram-products.json';
const importId='instagram-import-2026-11-12';
export async function ensureInstagramImport(db:any){
 const done=await db.prepare('SELECT id FROM records WHERE id = ?').bind(importId).first();
 if(done)return;
 // A one-time data import, outside schema migrations. Existing records and edits are preserved.
 const existing=await db.prepare('SELECT data FROM records WHERE kind = ?').bind('product').all();
 const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const names=new Set(existing.results.map((r:any)=>normal(JSON.parse(r.data).name)));
 const missing=products.filter(p=>!names.has(normal(p.name)));
 const writes=missing.map(p=>db.prepare('INSERT OR IGNORE INTO records (id,kind,data) VALUES (?,?,?)').bind(p.id,'product',JSON.stringify(p)));
 writes.push(db.prepare('INSERT OR IGNORE INTO records (id,kind,data) VALUES (?,?,?)').bind(importId,'system',JSON.stringify({count:missing.length,source:'https://www.instagram.com/espaco_solnatura/',importedAt:new Date().toISOString()})));
 await db.batch(writes);
}
