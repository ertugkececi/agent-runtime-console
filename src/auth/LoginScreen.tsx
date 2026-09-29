/**
 * The unauthorized state: no session (or one that ended). The sign-in link is
 * the only action; the platform redirects back to the console after the
 * session is established.
 */
export function LoginScreen() {
  return (
    <main className="app-centered">
      <section className="screen" aria-labelledby="login-heading">
        <h1 id="login-heading">Oturum gerekli</h1>
        <p>
          Oturumun sona erdi ya da henüz başlamadı. Devam etmek için yeniden giriş yap.
        </p>
        <p>
          <a href="/auth/login">Giriş yap</a>
        </p>
      </section>
    </main>
  );
}
