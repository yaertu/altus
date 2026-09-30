'use client'

import type { Delivery, Product } from '@/lib/types'

function fallbackFor(name:string,category=''){
  const v=`${name} ${category}`.toLocaleLowerCase('tr-TR')
  if(v.includes('buzdol'))return '/product-fallback/fridge.svg'
  if(v.includes('çamaşır')||v.includes('camasir'))return '/product-fallback/washer.svg'
  if(v.includes('bulaşık')||v.includes('bulasik'))return '/product-fallback/dishwasher.svg'
  if(v.includes('kurutma'))return '/product-fallback/dryer.svg'
  if(v.includes('tv')||v.includes('televizyon')||v.includes('google'))return '/product-fallback/tv.svg'
  if(v.includes('klima'))return '/product-fallback/ac.svg'
  if(v.includes('fırın')||v.includes('firin')||v.includes('ankastre'))return '/product-fallback/oven.svg'
  return '/product-fallback/appliance.svg'
}

export default function ProductVisual({delivery,product,size='md'}:{delivery?:Pick<Delivery,'product_name'|'product_model'|'product_image_url'>;product?:Pick<Product,'title'|'model'|'category'|'image_url'>;size?:'sm'|'md'|'lg'}){
  const title=delivery?.product_name||product?.title||'Ürün'
  const model=delivery?.product_model||product?.model||''
  const src=delivery?.product_image_url||product?.image_url||fallbackFor(title,product?.category)
  return <div className={`productVisual productVisual-${size}`}>
    <img src={src} alt={`${title}${model?` ${model}`:''}`} loading="lazy" onError={e=>{const img=e.currentTarget;if(!img.dataset.fallback){img.dataset.fallback='1';img.src=fallbackFor(title,product?.category)}}}/>
  </div>
}
