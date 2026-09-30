'use client'

import { useMemo, useState } from 'react'
import { ImagePlus, Search, UploadCloud } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types'
import ProductVisual from './product-visual'

export default function ProductMediaManager({orgId,products}:{orgId:string;products:Product[]}){
  const [items,setItems]=useState(products)
  const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState('')
  const [q,setQ]=useState('')
  const filtered=useMemo(()=>items.filter(p=>`${p.title} ${p.model} ${p.category}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))),[items,q])

  async function upload(product:Product,file:File){
    if(!file.type.startsWith('image/')){setMessage('Yalnız görsel dosyası yükleyebilirsin.');return}
    if(file.size>6*1024*1024){setMessage('Ürün görseli en fazla 6 MB olabilir.');return}
    setBusy(product.id);setMessage('')
    const supabase=createClient()
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')
    const path=`${orgId}/${product.id}/${Date.now()}.${ext}`
    const {error:uploadError}=await supabase.storage.from('product-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
    if(uploadError){setMessage(uploadError.message);setBusy(null);return}
    const {data}=supabase.storage.from('product-media').getPublicUrl(path)
    const imageUrl=data.publicUrl
    const {error}=await supabase.from('product_media').upsert({org_id:orgId,product_id:product.id,image_url:imageUrl,storage_path:path,updated_at:new Date().toISOString()},{onConflict:'org_id,product_id'})
    if(error){setMessage(error.message);setBusy(null);return}
    setItems(prev=>prev.map(p=>p.id===product.id?{...p,image_url:imageUrl}:p));setMessage(`${product.model} görseli güncellendi.`);setBusy(null)
  }

  return <section className="panel productMediaPanel premiumCatalogPanel">
    <div className="panelHead premiumSectionTitle"><div className="titleIcon"><ImagePlus size={18}/></div><div><span className="eyebrow">ÜRÜN KATALOĞU</span><h2>Kurye kartı görselleri</h2><p>Gerçek ürün fotoğraflarını yükle; sevkiyat oluşturulurken teslimata snapshot olarak kaydedilir.</p></div><span className="badge s-new">{items.length} ürün</span></div>
    <div className="catalogToolbar"><label><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Model veya kategori ara…"/></label><span>{filtered.length} ürün gösteriliyor</span></div>
    {message&&<div className={message.includes('güncellendi')?'success':'error'}>{message}</div>}
    <div className="productMediaGrid premiumProductGrid">{filtered.map(product=><article key={product.id} className="productMediaCard premiumProductCard">
      <div className="productVisualFrame"><ProductVisual product={product} size="lg"/><span>{product.image_url?'Özel görsel':'Varsayılan görsel'}</span></div>
      <div className="productMediaInfo"><small>{product.category}</small><strong>{product.title}</strong><span>{product.model}</span></div>
      <label className={`productUploadAction ${busy===product.id?'disabled':''}`}><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy===product.id} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void upload(product,file);e.currentTarget.value=''}}/><UploadCloud size={16}/>{busy===product.id?'Yükleniyor…':product.image_url?'Görseli değiştir':'Görsel yükle'}</label>
    </article>)}</div>
  </section>
}
