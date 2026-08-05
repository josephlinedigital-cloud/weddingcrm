import Link from "next/link";
import { requestReset } from "@/app/login/actions";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-header">
          <span className="login-monogram" aria-hidden="true">H</span>
          <h1>The Hume Wedding</h1>
        </header>
        <div className="login-form-card">
          <h2>Reset password</h2>
          <p className="auth-help">Enter the email used for your Supabase account.</p>
          {params.error && <div className="alert alert-error" role="alert">{params.error}</div>}
          {params.message && <div className="alert" role="status">{params.message}</div>}
          {!params.message && <form action={requestReset} className="login-form">
            <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="email" required autoFocus /></div>
            <button className="button button-primary login-submit" type="submit">Send reset link</button>
          </form>}
          <Link className="forgot-link" href="/login">Back to sign in</Link>
        </div>
      </section>
    </main>
  );
}
