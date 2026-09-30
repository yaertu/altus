import Link from 'next/link'
import { login } from './actions'
import DeveloperSignature from '@/components/developer-signature'
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;next?:string}>}){
  const {error,next}=await searchParams
  return <main className="loginPage"><section className="loginCard fadeIn">
    <div className="loginHero"><div className="brand"><div className="brandMark">A</div><div className="brandText"><strong>Altus Sevkiyat</strong><span style={{color:'#d8cbd3'}}>Kurumsal Operasyon</span></div></div><h1>Sevkiyat tek ekranda.<br/>Ekip anında haberdar.</h1><p>Mağaza kaydı oluşturur, görev sevkiyat personelinin telefonuna düşer. Kabul, yola çıkış, adres, teslimat kanıtı ve sonuç mağazada canlı görünür.</p></div>
    <form action={login} className="loginForm"><input type="hidden" name="next" value={next||'/dashboard'}/><div className="eyebrow">GÜVENLİ GİRİŞ</div><h2>Hesabınıza giriş yapın</h2><p>Mağaza, yönetici veya sevkiyat personeli hesabınızla devam edin.</p>{error&&<div className="error">E-posta/şifre hatalı veya hesabınız henüz aktif değil.</div>}<div className="stack"><div className="field"><label>E-posta</label><input className="input" type="email" name="email" autoComplete="email" required placeholder="personel@firma.com"/></div><div className="field"><label>Şifre</label><input className="input" type="password" name="password" autoComplete="current-password" required minLength={6}/></div><button className="btn btnPrimary btnLarge">Giriş Yap →</button><div className="authHelper"><Link href="/login/forgot">Şifremi unuttum</Link></div></div><DeveloperSignature/><div className="loginLegal"><Link href="/privacy">Gizlilik</Link><span>•</span><Link href="/terms">Kullanım koşulları</Link></div></form>
  </section></main>
}
