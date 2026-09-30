import { Code2, ShieldCheck, Sparkles } from 'lucide-react'

export default function DeveloperSignature(){
  return <aside className="developerSignature" aria-label="Geliştirici ve ürün sahipliği">
    <span className="developerSignatureIcon"><Code2 size={18}/><i/></span>
    <span className="developerSignatureCopy">
      <small><Sparkles size={11}/> TASARIM · YAZILIM · ÜRÜN</small>
      <strong>yaaertu <em>codeR</em></strong>
      <span><ShieldCheck size={12}/> © 2026 · Tüm hakları saklıdır.</span>
    </span>
  </aside>
}
