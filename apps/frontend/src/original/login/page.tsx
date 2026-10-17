import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { CompatLink as Link } from "../session";

export default function LoginPage({
  searchParams,
}: {
  searchParams: {
    error?: string;
    employee_error?: string;
    admin_error?: string;
    admin?: string;
  };
}) {
  const { error, employee_error, admin_error, admin } = searchParams;

  return (
    <main className="executive-login">
      <div className="executive-login-bg" aria-hidden="true" />
      <header className="executive-login-header">
        <Link className="executive-login-brand" href="/" aria-label="Aviation Insight home">
          <span>AVIATION</span> INSIGHT
        </Link>
        <Link className="executive-back" href="/">
          <ArrowLeft size={16} /> Back to home
        </Link>
      </header>

      <section className="executive-login-intro" aria-label="Aviation Insight introduction">
        <span>AVIATION OPERATIONS</span>
        <h1>Clarity for every<br />operational decision.</h1>
        <p>A unified view of aviation performance, built for confident and timely decisions.</p>
      </section>

      <section className="executive-login-card" aria-label="Secure platform access">
        <div className="executive-card-mark"><LockKeyhole size={21} /></div>
        <p className="executive-kicker">SECURE ACCESS</p>
        <h2>{admin ? "Administrator access" : "Welcome to Aviation Insight"}</h2>
        <p className="executive-subtitle">
          {admin ? "Enter your administrator credentials." : "Operational Performance Portal"}
        </p>

        {!admin ? (
          <>
            <form className="executive-form" action="/api/login" method="post">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required autoFocus />
              {error && <p className="executive-error">Incorrect password. Please try again.</p>}
              <button type="submit">Enter Platform <ArrowRight size={17} /></button>
            </form>

            <details className="executive-employee" open={Boolean(employee_error)}>
              <summary><UserRound size={16} /> Employee Access</summary>
              <form className="executive-form" action="/api/employee-login" method="post">
                <label htmlFor="username">Username</label>
                <input id="username" name="username" autoComplete="username" placeholder="Enter username" required />
                <label htmlFor="employee-password">Password</label>
                <input id="employee-password" name="password" type="password" autoComplete="current-password" placeholder="Enter password" required />
                {employee_error && <p className="executive-error">Incorrect employee username or password.</p>}
                <button type="submit">Employee Login <ArrowRight size={17} /></button>
              </form>
            </details>

            <a className="executive-admin-link" href="/login?admin=1">Administrator</a>
          </>
        ) : (
          <form className="executive-form" action="/api/admin-login" method="post">
            <label htmlFor="admin-username">Admin username</label>
            <input id="admin-username" name="username" autoComplete="username" placeholder="Enter username" required autoFocus />
            <label htmlFor="admin-password">Admin password</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" placeholder="Enter password" required />
            {admin_error && <p className="executive-error">Incorrect administrator credentials.</p>}
            <button type="submit">Enter Platform <ArrowRight size={17} /></button>
            <a className="executive-admin-link" href="/login">Back to portal access</a>
          </form>
        )}

        <div className="executive-security"><ShieldCheck size={15} /> Protected internal access</div>
      </section>

      <footer className="executive-login-footer">AVIATION INSIGHT · INTERNAL &amp; CONFIDENTIAL</footer>
    </main>
  );
}
