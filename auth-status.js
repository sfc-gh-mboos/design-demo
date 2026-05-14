(function () {
  const AUTH_API = "/api/auth";

  function setStatusAnonymous(node) {
    if (!node) return;
    node.dataset.state = "anonymous";
    node.innerHTML = `
      <a href="/signup" class="auth-link auth-link--ghost">Sign up</a>
      <a href="/login" class="auth-link">Log in</a>
    `;
  }

  function setStatusLoggedIn(node, user) {
    if (!node) return;
    node.dataset.state = "authenticated";
    const safeName = (user.display_name || user.username).replace(/[<>&"]/g, "");
    node.innerHTML = `
      <span class="auth-greeting" title="@${user.username}">${safeName}</span>
      <button type="button" class="auth-link auth-logout" id="authLogoutBtn">Log out</button>
    `;
    const btn = node.querySelector("#authLogoutBtn");
    if (btn) btn.addEventListener("click", handleLogout);
  }

  async function handleLogout() {
    try {
      await fetch(`${AUTH_API}/logout`, { method: "POST", credentials: "same-origin" });
    } catch (err) {
      // Ignore network errors; we still wipe local state and reload.
    }
    window.location.href = "/login";
  }

  async function refreshAuthStatus() {
    const node = document.getElementById("authStatus");
    if (!node) return null;
    try {
      const res = await fetch(`${AUTH_API}/me`, { credentials: "same-origin" });
      if (res.status === 200) {
        const user = await res.json();
        setStatusLoggedIn(node, user);
        document.body.dataset.authState = "authenticated";
        return user;
      }
    } catch (err) {
      // Treat fetch errors as anonymous so the topbar still renders.
    }
    setStatusAnonymous(node);
    document.body.dataset.authState = "anonymous";
    return null;
  }

  window.TaskflowAuth = {
    refresh: refreshAuthStatus,
    logout: handleLogout,
  };

  document.addEventListener("DOMContentLoaded", refreshAuthStatus);
})();
