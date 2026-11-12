import Storefront from '../../storefront';
import {getPublicCategory} from '../../catalog-server';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props){const name=await getPublicCategory((await params).slug);return {title:name?`${name} | Solnatura`:'Categoria não encontrada | Solnatura'};}
export default async function Page({params}:Props){const {slug}=await params;if(!await getPublicCategory(slug))notFound();return <Storefront route="category" identifier={slug}/>;}
