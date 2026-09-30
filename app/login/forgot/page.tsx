import Link from 'next/link'
import { requestPasswordReset } from '../actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const { error, sent } = await searchParams
  return (
    <main className="loginPage">
      <section className="loginCard loginCardSingle fadeIn">
        <form action={requestPasswordReset} className="loginForm resetForm">
          <div className="eyebrow">HESAP KURTARMA</div>
          <h2>Şifrenizi yenileyin</h2>
          <p>Kurumsal e-posta adresinizi girin. Hesap mevcutsa güvenli şifre yenileme bağlantısı gönderilir.</p>
          {sent && <div className="successBox">İstek alındı. E-posta kutunuzu ve spam klasörünü kontrol edin.</div>}
          {error && <div className="error">Geçerli bir e-posta adresi girin.</div>}
          <div className="stack">
            <div className="field">
              <label>E-posta</label>
              <input className="input" type="email" name="email" autoComplete="email" required placeholder="personel@firma.com" />
            </div>
            <button className="btn btnPrimary btnLarge">Sıfırlama bağlantısı gönder →</button>
          </div>
          <div className="loginLegal"><Link href="/login">← Giriş ekranına dön</Link></div>
        </form>
      </section>
    </main>
  )
}
