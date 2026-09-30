import Link from 'next/link'
import { updatePassword } from '@/app/login/actions'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="loginPage">
      <section className="loginCard loginCardSingle fadeIn">
        <form action={updatePassword} className="loginForm resetForm">
          <div className="eyebrow">YENİ ŞİFRE</div>
          <h2>Hesabınızı güvene alın</h2>
          <p>En az 10 karakterden oluşan, başka hesaplarda kullanmadığınız güçlü bir şifre belirleyin.</p>
          {error && <div className="error">Şifreler eşleşmiyor, yeterince güçlü değil veya kurtarma oturumu sona ermiş olabilir.</div>}
          <div className="stack">
            <div className="field"><label>Yeni şifre</label><input className="input" type="password" name="password" autoComplete="new-password" required minLength={10} /></div>
            <div className="field"><label>Yeni şifre tekrar</label><input className="input" type="password" name="confirm" autoComplete="new-password" required minLength={10} /></div>
            <button className="btn btnPrimary btnLarge">Şifreyi güncelle →</button>
          </div>
          <div className="loginLegal"><Link href="/login">Giriş ekranı</Link></div>
        </form>
      </section>
    </main>
  )
}
