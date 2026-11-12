import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('drizzle/0000_chubby_human_robot.sql','utf8'));
let user=null;const emails=[];let mailFailure=false;
const bucket=new Map();
const runtime = {
 DB: {
  prepare(sql) {
   let args=[];
   return {
    bind(...a) { args=a; return this; },
    async first() { return db.prepare(sql).get(...args)||null; },
    async all() { return {results:db.prepare(sql).all(...args)}; },
    async run() { const r=db.prepare(sql).run(...args); return {meta:{changes:Number(r.changes)}}; }
   };
  }
 },
 BUCKET: {
  async put(k,v,o) { bucket.set(k,{body:v,...o}); },
  async get(k) { return bucket.get(k); }
 }
};
globalThis.__shopTest={runtime,user:()=>user};
globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');emails.push(JSON.parse(opts.body));return new Response('{}',{status:mailFailure?503:200});};
let src=fs.readFileSync('app/api/shop/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.__shopTest.runtime;").replace("import { getChatGPTUser } from '../../chatgpt-auth';","const getChatGPTUser=async()=>globalThis.__shopTest.user();").replace("import { ensureInstagramImport } from '../../instagram-import';","const ensureInstagramImport=async()=>{};");
const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
async function post(body,origin='https://shop.test'){const r=await api.POST(new Request('https://shop.test/api/shop',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,...await r.json()};}
async function get(){return(await api.GET(new Request('https://shop.test/api/shop'))).json()}
const catalogueSource=fs.readFileSync('app/catalog-server.ts','utf8').replace("import {env} from 'cloudflare:workers';","const env=globalThis.__shopTest.runtime;").replace("import {ensureInstagramImport} from './instagram-import';","const ensureInstagramImport=async()=>{};");
const catalogueCode=ts.transpileModule(catalogueSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const catalogue=await import('data:text/javascript;base64,'+Buffer.from(catalogueCode).toString('base64'));
assert.equal(await catalogue.getPublicProduct('demo2'),null,'no placeholder products in empty catalogue');
assert.equal(await catalogue.getPublicProduct('missing'),null,'missing product');
assert.equal(await catalogue.getPublicCategory('cosmetica-natural'),null,'no placeholder categories');
assert.equal((await post({action:'claim'})).status,401);
user={userId:'owner',email:'owner@example.test'};assert.equal((await post({action:'claim'})).ok,true);
let p={name:'Produto A',price:12.5,category:'Chás',description:'Teste',active:true,image:'',stock:3};
assert.equal((await post({action:'product',product:{...p,id:'owner'}})).status,400,'reserved identifiers rejected');
assert.equal((await post({action:'product',product:{...p,price:-1}})).status,400);
assert.equal((await post({action:'product',product:{...p,stock:1.5}})).status,400);
assert.equal((await post({action:'product',product:p})).ok,true);p=(await get()).products[0];
assert.equal((await post({action:'visibility',id:p.id})).ok,true);
assert.equal(await catalogue.getPublicProduct(p.id),null,'hidden products are not accessible by URL');
user=null;assert.equal((await get()).products.length,0,'hidden products excluded');assert.equal((await post({action:'product',product:p})).status,403);
user={userId:'owner',email:'owner@example.test'};assert.equal((await post({action:'visibility',id:p.id})).ok,true);
assert.equal((await catalogue.getPublicProduct(p.id)).name,'Produto A');
assert.equal(await catalogue.getPublicProduct('demo2'),null,'demo links disappear once a real catalogue exists');
assert.equal((await post({action:'delete',id:p.id})).ok,true);assert.equal((await get()).products[0].deleted,true);
assert.equal((await post({action:'restore',id:p.id})).ok,true);assert.equal((await get()).products[0].deleted,false);
assert.equal((await post({action:'settings',settings:{email:'shop@example.test',pickupEnabled:false,deliveryEnabled:false}})).status,400);
assert.equal((await post({action:'settings',settings:{email:'shop@example.test',pickupEnabled:true,deliveryEnabled:true,iban:'TEST-IBAN',mbway:'TEST-MBWAY',catalogueReviewed:true,legalName:'Loja de teste',nif:'123456789',address:'Morada de teste',phone:'210000000',delivery:'Condições de teste',returns:'Devoluções de teste',privacyRetention:'Conservação de teste',privacyProviders:'Prestadores de teste',paymentTerms:'Pagamento de teste',complaintsUrl:'https://www.livroreclamacoes.pt/',ralName:'Entidade de teste',ralUrl:'https://example.test/'}})).ok,true);
user=null;const pub=await get();assert.equal(pub.settings.pickupEnabled,false);assert.equal(pub.settings.iban,undefined);assert.equal(pub.settings.mbway,undefined);assert.equal(pub.orders,undefined);assert.equal(pub.ready,false);
const o={action:'order',requestId:crypto.randomUUID(),name:'Cliente Teste',email:'client@example.test',phone:'910000000',delivery:'Entrega',address:'Rua de teste 123',postalCode:'1000-001',city:'Lisboa',consent:true,items:[{id:p.id,qty:2}],website:''};
assert.equal((await post(o)).status,503,'unconfigured orders refused');runtime.RESEND_API_KEY='test-key';runtime.MAIL_FROM='test@example.test';
const savedSettings=JSON.parse(db.prepare('SELECT data FROM records WHERE id = ?').get('settings').data);
db.prepare('UPDATE records SET data = ? WHERE id = ?').run(JSON.stringify({...savedSettings,catalogueReviewed:false}),'settings');
assert.equal((await post(o)).status,503,'unreviewed catalogue cannot accept requests');
db.prepare('UPDATE records SET data = ? WHERE id = ?').run(JSON.stringify(savedSettings),'settings');
assert.equal((await post({...o,consent:false})).status,400);
assert.equal((await post({...o,delivery:'Levantamento em loja'})).status,400);
assert.equal((await post({...o,delivery:'Entrega',address:'Rua de teste 123',postalCode:'wrong',city:'Lisboa'})).status,400);
assert.equal((await post({...o,requestId:crypto.randomUUID(),items:[{id:p.id,qty:4}]})).status,409,'stock verified on server');
assert.equal((await post({...o,requestId:crypto.randomUUID(),items:[{id:p.id,qty:1},{id:p.id,qty:1}]})).status,409);
const sent=await post({...o,total:0,items:[{id:p.id,qty:2,price:0}]});assert.equal(sent.ok,true);assert.equal(emails.length,2);
assert.equal((await post(o)).ok,true);assert.equal(emails.length,2,'retry does not duplicate email');
user={userId:'owner',email:'owner@example.test'};let orders=(await get()).orders;assert.equal(orders.length,1);assert.equal(orders[0].total,25,'price taken from catalogue, not customer');
assert.equal((await post({action:'status',id:p.id,status:'Pago'})).status,400,'product cannot be overwritten as order');
assert.equal((await post({action:'status',id:o.requestId,status:'Pago'})).ok,true);assert.equal((await get()).orders[0].status,'Pago');
assert.equal((await post({action:'delete',id:p.id},'https://evil.test')).status,403);
user={userId:'intruder',email:'other@example.test'};assert.equal((await post({action:'claim'})).ok,false);assert.equal((await post({action:'settings',settings:{}})).status,403);
user=null;mailFailure=true;const failure=await post({...o,requestId:crypto.randomUUID(),email:'second@example.test'});assert.equal(failure.ok,true);assert.ok(failure.warning);
user={userId:'owner',email:'owner@example.test'};orders=(await get()).orders;assert.equal(orders.length,2);assert.equal(orders.find(x=>x.id===failure.id).notification,'loja pendente','email failures keep the order');
assert.equal((await post({action:'upload',type:'image/png',data:btoa('not-an-image')})).status,400);
console.log('PASS · autorizações, privacidade, catálogo, recuperação, stock, checkout, preços, reenvio idempotente, e-mails e estados.');

// Unknown prices remain unknown in orders and in both e-mail notifications.
user={userId:'owner',email:'owner@example.test'};
assert.equal((await post({action:'product',product:{...p,price:0,priceOnRequest:true,image:'/images/instagram/cha-verde.jpg'}})).ok,true);
user=null;mailFailure=false;
const quoteOrder=await post({...o,requestId:crypto.randomUUID(),email:'quote@example.test',items:[{id:p.id,qty:1}]});
assert.equal(quoteOrder.ok,true);
user={userId:'owner',email:'owner@example.test'};
const savedQuote=(await get()).orders.find(x=>x.id===quoteOrder.id);
assert.equal(savedQuote.total,null);assert.equal(savedQuote.items[0].priceOnRequest,true);
assert.ok(emails.at(-1).text.includes('Preço sob consulta'));assert.ok(!emails.at(-1).text.includes('0.00 EUR'));
// The one-off import is repeatable and cannot overwrite subsequent shop edits.
const seedProducts=JSON.parse(fs.readFileSync('data/instagram-products.json','utf8'));
assert.equal(seedProducts.length,36);assert.equal(new Set(seedProducts.map(p=>p.id)).size,36);
for(const product of seedProducts){assert.equal(product.stock,null);assert.equal(product.priceOnRequest,true);assert.ok(fs.existsSync('public'+product.image));assert.ok(product.sourceUrl.startsWith('https://www.instagram.com/'));}
runtime.DB.batch=async statements=>{db.exec('BEGIN');try{for(const statement of statements)await statement.run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};
globalThis.__shopTest.seedProducts=seedProducts;
const seedSource=fs.readFileSync('app/instagram-import.ts','utf8').replace("import products from '../data/instagram-products.json';",'const products=globalThis.__shopTest.seedProducts;');
const seedCode=ts.transpileModule(seedSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const importer=await import('data:text/javascript;base64,'+Buffer.from(seedCode).toString('base64'));
await importer.ensureInstagramImport(runtime.DB);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='product'").get().n,37);
const changed={...seedProducts[0],name:'Nome atualizado pelo gestor',price:9.5,priceOnRequest:false,stock:7};
db.prepare('UPDATE records SET data=? WHERE id=?').run(JSON.stringify(changed),changed.id);
await importer.ensureInstagramImport(runtime.DB);
const preserved=JSON.parse(db.prepare('SELECT data FROM records WHERE id=?').get(changed.id).data);
assert.equal(preserved.price,9.5);assert.equal(preserved.stock,7);assert.equal(preserved.name,changed.name);
console.log('PASS · 36 produtos com imagens, importação sem duplicados, alterações preservadas e preços sob consulta.');
