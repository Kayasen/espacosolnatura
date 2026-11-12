import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureInstagramImport } from '../../instagram-import';
export const dynamic = 'force-dynamic';
const E = () => env as any;
const json = (data:any,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid = (v:any) => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const email = (v:any) => typeof v==='string' && v.length<=200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const clean = (v:any,n=500) => String(v??'').trim().slice(0,n);
const defaults = {email:'',phone:'',address:'',hours:'',intro:'Uma loja online para cuidar de si, com produtos naturais e atendimento próximo.',delivery:'',pickupEnabled:false,deliveryEnabled:true,legalName:'',nif:'',returns:'',privacyRetention:'',iban:'',mbway:'',paymentTerms:'',complaintsUrl:'',ralName:'',ralUrl:'',privacyProviders:'',catalogueReviewed:false};
const legalComplete=(s:any)=>!!(s.legalName&&/^\d{9}$/.test(s.nif)&&s.address&&s.email&&s.phone&&s.delivery&&s.returns&&s.privacyRetention&&s.paymentTerms&&s.privacyProviders&&s.complaintsUrl&&s.ralName&&s.ralUrl);
async function read(id:string){const row=await E().DB.prepare('SELECT data FROM records WHERE id = ?').bind(id).first();return row?JSON.parse(row.data):null;}
async function list(kind:string){const r=await E().DB.prepare('SELECT data FROM records WHERE kind = ? ORDER BY rowid DESC').bind(kind).all();return r.results.map((r:any)=>JSON.parse(r.data));}
async function save(id:string,kind:string,data:any){await E().DB.prepare('INSERT INTO records (id,kind,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id,kind,JSON.stringify(data)).run();}
async function admin(){const u=await getChatGPTUser();return !!u && (await read('owner'))?.id===u.userId;}
async function send(to:string,reply:string,subject:string,text:string,key:string){try {const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${E().RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:E().MAIL_FROM,to:[to],reply_to:reply,subject,text})});return r.ok;}catch{return false;}}
export async function GET(req:Request){
 try{
  const url=new URL(req.url);
  if(url.searchParams.has('image')){const key=url.searchParams.get('image')||'';if(!key.startsWith('products/'))return new Response('Não encontrado',{status:404});const obj=await E().BUCKET.get(key);if(!obj)return new Response('Não encontrado',{status:404});return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});}
  await ensureInstagramImport(E().DB);
  const isAdmin=await admin();
  const settings={...defaults,...await read('settings'),pickupEnabled:false};
  const products=await list('product');
  const {iban,mbway,...publicSettings}=settings;
  return json({products:isAdmin?products:products.filter((p:any)=>p.active&&!p.deleted),settings:isAdmin?settings:publicSettings,isAdmin,legalReady:legalComplete(settings),ready:!!(settings.catalogueReviewed&&legalComplete(settings)&&settings.email&&E().RESEND_API_KEY&&E().MAIL_FROM&&(settings.pickupEnabled||settings.deliveryEnabled)),...(isAdmin?{setupTasks:[...['legalName','nif','email','phone','address','delivery','paymentTerms','returns','privacyRetention','privacyProviders','complaintsUrl','ralName','ralUrl'].map((key)=>({label:({legalName:'Nome legal da titular',nif:'NIF da titular',email:'E-mail de contacto',phone:'Telefone de contacto',address:'Morada legal e de devoluções',delivery:'Zonas de envio, portes e prazos',paymentTerms:'Condições de pagamento',returns:'Condições de devolução',privacyRetention:'Conservação de dados',privacyProviders:'Prestadores de tratamento de dados',complaintsUrl:'Livro de Reclamações da titular',ralName:'Entidade de resolução de litígios',ralUrl:'Site da entidade de litígios'} as Record<string,string>)[key],done:!!settings[key],href:'/gestao/configuracoes'})),{label:'Revisão dos produtos e imagens',done:!!settings.catalogueReviewed,href:'/gestao/configuracoes'},{label:'Notificações de pedidos',done:!!(E().RESEND_API_KEY&&E().MAIL_FROM),href:'/gestao/configuracoes'}],orders:await list('order'),mailConfigured:!!(E().RESEND_API_KEY&&E().MAIL_FROM)}:{})});
 }catch{return json({error:'Não conseguimos carregar a loja. Tente novamente.'},500);}
}
export async function POST(req:Request){
 try{
  if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
  if(Number(req.headers.get('content-length')||0)>4500000)return json({error:'Escolha uma imagem até 3 MB.'},413);
  const b=await req.json() as any;
  if(b.action==='claim'){
   const u=await getChatGPTUser();if(!u)return json({error:'Inicie sessão com a conta do proprietário.'},401);
   // The first setup must be performed by the owner while the hosting audience is owner-private.
   await E().DB.prepare('INSERT OR IGNORE INTO records (id,kind,data) VALUES (?,?,?)').bind('owner','system',JSON.stringify({id:u.userId})).run();
   return json({ok:await admin()});
  }
  if(b.action==='order'){
   const s={...defaults,...await read('settings'),pickupEnabled:false};
   if(!s.email||!E().RESEND_API_KEY||!E().MAIL_FROM)return json({error:'Os pedidos online ainda não estão ativos. Fale connosco para pedir ajuda.'},503);
   if(!s.catalogueReviewed||!legalComplete(s))return json({error:'Para informações sobre os produtos, contacte a Solnatura.'},503);
   if(b.website)return json({error:'Pedido inválido.'},400);
   if(!uuid(b.requestId)||b.consent!==true||typeof b.name!=='string'||b.name.trim().length<2||b.name.length>100||!email(b.email)||typeof b.phone!=='string'||b.phone.replace(/\D/g,'').length<9||b.phone.length>30||!['Levantamento em loja','Entrega'].includes(b.delivery)||!Array.isArray(b.items)||!b.items.length||b.items.length>40)return json({error:'Verifique o nome, e-mail, telefone e os produtos do pedido.'},400);
   if(b.delivery==='Entrega'&&(!s.deliveryEnabled||clean(b.address).length<10||!/^\d{4}-\d{3}$/.test(b.postalCode||'')||clean(b.city).length<2))return json({error:'Preencha a morada, o código postal (0000-000) e a localidade para entrega.'},400);
   if(b.delivery==='Levantamento em loja'&&!s.pickupEnabled)return json({error:'O levantamento em loja não está disponível.'},400);
   const prior=await read(b.requestId);
   if(prior){if(prior.email!==b.email)return json({error:'Referência inválida. Atualize a página.'},409);return json({ok:true,id:prior.id,warning:prior.notification!=='enviado'?'Pedido já registado. Aguarde a resposta da loja antes de pagar.':undefined});}
   const windowId=String(Math.floor(Date.now()/900000)).padStart(12,'0');
   const previousWindow=String(Math.floor(Date.now()/900000)-1).padStart(12,'0');
   await E().DB.prepare('DELETE FROM records WHERE kind = ? AND id < ?').bind('rate','rate:'+previousWindow).run();
   for(const [scope,source,limit] of [['email',b.email.toLowerCase(),5],['ip',req.headers.get('cf-connecting-ip')||b.email.toLowerCase(),12]] as const){
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(source)));
    const key='rate:'+windowId+':'+scope+':'+Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
    const counted=await E().DB.prepare('INSERT INTO records (id,kind,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=CAST(CAST(records.data AS INTEGER)+1 AS TEXT) WHERE CAST(records.data AS INTEGER) < ? RETURNING data').bind(key,'rate','1',limit).first();
    if(!counted)return json({error:'Já recebemos vários pedidos seus. Aguarde alguns minutos antes de voltar a enviar ou contacte a loja.'},429);
   }
   const all=await list('product');const items:any[]=[];const seen=new Set();
   for(const it of b.items){const p=all.find((p:any)=>p.id===it.id);if(!p||!p.active||p.deleted||!Number.isInteger(it.qty)||it.qty<1||it.qty>99||seen.has(it.id)||(p.stock!==null&&p.stock!==undefined&&it.qty>p.stock))return json({error:'A disponibilidade de um artigo mudou. Reveja o seu carrinho.'},409);seen.add(it.id);items.push({id:p.id,name:p.name,brand:p.brand||'',size:p.size||'',price:p.price,priceOnRequest:!!p.priceOnRequest,qty:it.qty});}
   const order={id:b.requestId,date:new Date().toISOString(),status:'Novo',name:b.name.trim(),email:b.email,phone:b.phone,delivery:b.delivery,address:b.delivery==='Entrega'?clean(b.address):'',postalCode:b.delivery==='Entrega'?b.postalCode:'',city:b.delivery==='Entrega'?clean(b.city,100):'',nif:clean(b.nif,9),notes:clean(b.notes,1500),items,total:items.some(i=>i.priceOnRequest)?null:Math.round(items.reduce((a,i)=>a+i.price*i.qty,0)*100)/100,notification:'pendente',consentAt:new Date().toISOString()};
   if(order.nif&&!/^\d{9}$/.test(order.nif))return json({error:'O NIF deve ter 9 algarismos, ou pode deixar o campo vazio.'},400);
   const inserted=await E().DB.prepare('INSERT OR IGNORE INTO records (id,kind,data) VALUES (?,?,?)').bind(order.id,'order',JSON.stringify(order)).run();
   if(inserted.meta?.changes===0)return json({ok:true,id:order.id,warning:'Pedido já registado. Aguarde a resposta da loja.'});
   const reference=order.id.slice(0,8).toUpperCase();
   const text=`Pedido ${reference}\n\nCliente: ${order.name}\nE-mail: ${order.email}\nTelefone: ${order.phone}\nNIF: ${order.nif||'Não indicado'}\nReceção: ${order.delivery}\n${order.address} ${order.postalCode} ${order.city}\n\n${items.map(i=>`${i.qty} × ${i.name}${i.size?' · '+i.size:''}: ${i.priceOnRequest?'Preço sob consulta':(i.price*i.qty).toFixed(2)+' EUR'}`).join('\n')}\n\nTotal de produtos: ${order.total===null?'A confirmar pela loja':order.total.toFixed(2)+' EUR'}\nOs eventuais portes, a disponibilidade e o prazo são confirmados pela loja.\nObservações: ${order.notes||'Sem observações'}\n\nEste registo não é uma confirmação de pagamento. A Solnatura irá confirmar o pedido e enviar as instruções de pagamento por e-mail. Não pague antes dessa confirmação.`;
   const shopSent=await send(s.email,order.email,`Novo pedido Solnatura · ${reference}`,text,order.id+'-shop');
   const customerSent=await send(order.email,s.email,`Recebemos o seu pedido · ${reference}`,`Olá, ${order.name}.\n\nRecebemos o seu pedido. Aguarde a nossa confirmação e as instruções de pagamento.\n\n${text}`,order.id+'-customer');
   await save(order.id,'order',{...order,notification:shopSent&&customerSent?'enviado':!shopSent?'loja pendente':'cliente pendente'});
   return json({ok:true,id:order.id,...(!shopSent||!customerSent?{warning:'Pedido registado. Uma das notificações por e-mail está pendente. Guarde a referência e aguarde o contacto da loja antes de pagar.'}:{})});
  }
  if(!await admin())return json({error:'Esta área está reservada à gestão da loja.'},403);
  if(b.action==='product'){
   const p=b.product;
   if(!p||!clean(p.name)||String(p.name).length>150||!Number.isFinite(p.price)||p.price<0||p.price>100000||!clean(p.category)||String(p.category).length>80||(p.id&&!uuid(p.id))||(p.stock!==null&&p.stock!==undefined&&(!Number.isInteger(p.stock)||p.stock<0||p.stock>999999))||String(p.description||'').length>3000||(!/^https:\/\//.test(p.image||'')&&!/^\/api\/shop\?image=products%2F/.test(p.image||'')&&!/^\/images\/(?:instagram\/[a-z0-9-]+\.jpg|catalogue\/[a-z0-9-]+\.webp)$/.test(p.image||'')&&p.image))return json({error:'Verifique o nome, a categoria, o preço e o stock do produto.'},400);
   const current=p.id?(await list('product')).find((x:any)=>x.id===p.id):null;
   if(p.id&&!current)return json({error:'O produto já não existe. Atualize o catálogo.'},404);
   const product={id:p.id||crypto.randomUUID(),name:clean(p.name,150),price:Math.round(p.price*100)/100,priceOnRequest:!!p.priceOnRequest,sourceUrl:current?.sourceUrl||'',importKey:current?.importKey||'',category:clean(p.category,80),description:clean(p.description,3000),image:clean(p.image,1500),active:!!p.active,featured:!!p.featured,brand:clean(p.brand,100),size:clean(p.size,100),ingredients:clean(p.ingredients,2000),usage:clean(p.usage,2000),precautions:clean(p.precautions,2000),stock:p.stock??null,deleted:current?.deleted||false,updatedAt:new Date().toISOString()};
   await save(product.id,'product',product);return json({ok:true});
  }
  if(['delete','restore','visibility'].includes(b.action)){
   const p=(await list('product')).find((x:any)=>x.id===b.id);if(!p)return json({error:'Produto não encontrado.'},404);
   await save(p.id,'product',{...p,...(b.action==='visibility'?{active:!p.active}:{deleted:b.action==='delete'})});return json({ok:true});
  }
  if(b.action==='settings'){
   const s=b.settings;if(!s||s.email&&!email(s.email))return json({error:'Verifique o e-mail da loja.'},400);
   if(s.deliveryEnabled===false)return json({error:'Ative a entrega para receber pedidos.'},400);
   for(const k of ['complaintsUrl','ralUrl']){if(s[k]&&!/^https:\/\//i.test(s[k]))return json({error:'Utilize ligações HTTPS válidas.'},400);}
   const safe:any={};for(const k of Object.keys(defaults)){safe[k]=(k.endsWith('Enabled')||k==='catalogueReviewed')?!!s[k]:clean(s[k],k==='returns'?4000:k==='intro'?700:500);}
   safe.pickupEnabled=false;safe.hours='';await save('settings','system',safe);return json({ok:true});
  }
  if(b.action==='status'){
   const o=(await list('order')).find((x:any)=>x.id===b.id);
   if(!o||!['Novo','A aguardar pagamento','Pago','Em preparação','Concluído','Cancelado'].includes(b.status))return json({error:'Estado inválido.'},400);
   await save(o.id,'order',{...o,status:b.status,updatedAt:new Date().toISOString()});return json({ok:true});
  }
  if(b.action==='upload'){
   if(!/^image\/(jpeg|png|webp)$/.test(b.type)||typeof b.data!=='string'||b.data.length>4000000)return json({error:'Use uma imagem JPG, PNG ou WebP até 3 MB.'},400);
   const bytes=Uint8Array.from(atob(b.data),c=>c.charCodeAt(0));
   const valid=b.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:b.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===82&&bytes[1]===73&&bytes[8]===87&&bytes[9]===69;
   if(!valid)return json({error:'Não foi possível reconhecer a imagem. Escolha outro ficheiro.'},400);
   const key='products/'+crypto.randomUUID();await E().BUCKET.put(key,bytes,{httpMetadata:{contentType:b.type}});return json({url:'/api/shop?image='+encodeURIComponent(key)});
  }
  return json({error:'Ação inválida.'},400);
 }catch{return json({error:'Não foi possível concluir. Tente novamente ou contacte a loja.'},500);}
}
