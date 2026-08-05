import { login } from "./actions";
import Link from "next/link";
import { isSupabaseConfigured, supabaseConfigurationError } from "@/lib/supabase/config";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-header">
          <span className="login-monogram" aria-hidden="true">H</span>
          <h1>The Hume Wedding</h1>
        </header>
        <div className="login-form-card">
          <h2>Sign in</h2>
          {!isSupabaseConfigured && <div className="alert">{supabaseConfigurationError}</div>}
          {params.error && <div className="alert alert-error" role="alert">{params.error}</div>}
          {params.message && <div className="alert" role="status">{params.message}</div>}
          <form action={login} className="login-form">
            <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <button className="button button-primary login-submit" type="submit" disabled={!isSupabaseConfigured}>Sign in</button>
          </form>
          <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>
        </div>
      </section>
    </main>
  );
}
