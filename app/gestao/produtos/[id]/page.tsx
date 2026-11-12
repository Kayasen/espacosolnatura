import Storefront from '../../../storefront';
export const metadata={title:'Editar produto | Solnatura'};
export default async function Page({params}:{params:Promise<{id:string}>}){const p=await params;return <Storefront route="admin-edit" identifier={p.id}/>;}
