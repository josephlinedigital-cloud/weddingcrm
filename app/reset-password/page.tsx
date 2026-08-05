import { updatePassword } from "./actions";

export const metadata = { title: "Choose a password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-header">
          <span className="login-monogram" aria-hidden="true">H</span>
          <h1>The Hume Wedding</h1>
        </header>
        <div className="login-form-card">
          <h2>Choose a new password</h2>
          <p className="auth-help">Use at least 8 characters.</p>
          {params.error && <div className="alert alert-error" role="alert">{params.error}</div>}
          <form action={updatePassword} className="login-form">
            <div className="field"><label htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus /></div>
            <div className="field"><label htmlFor="confirmation">Confirm password</label><input className="input" id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></div>
            <button className="button button-primary login-submit" type="submit">Save password</button>
          </form>
        </div>
      </section>
    </main>
  );
}
