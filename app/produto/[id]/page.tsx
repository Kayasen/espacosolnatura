import Storefront from '../../storefront';
import {getPublicProduct} from '../../catalog-server';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props){const p=await getPublicProduct((await params).id);return {title:p?`${p.name} | Solnatura`:'Produto não encontrado | Solnatura',description:p?.description?.slice(0,150)||'Conheça os produtos da Solnatura e envie o seu pedido com acompanhamento pessoal.'};}
export default async function Page({params}:Props){const {id}=await params;if(!await getPublicProduct(id))notFound();return <Storefront route="product" identifier={id}/>;}
