import {env} from 'cloudflare:workers';
import {ensureInstagramImport} from './instagram-import';
export function categorySlug(name:string){return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export async function getPublicCatalogue(){await ensureInstagramImport((env as any).DB);const {results}=await (env as any).DB.prepare('SELECT data FROM records WHERE kind = ?').bind('product').all();const products=results.map((r:any)=>JSON.parse(r.data)).filter((p:any)=>p.active&&!p.deleted);return products;}
export async function getPublicProduct(id:string){return (await getPublicCatalogue()).find((p:any)=>p.id===id)||null;}
export async function getPublicCategory(slug:string){return (await getPublicCatalogue()).find((p:any)=>categorySlug(p.category)===slug)?.category||null;}
