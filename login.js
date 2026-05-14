document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("authError");
  const submitBtn = form.querySelector("button[type=submit]");

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
      showError("Username and password are required.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showError(body.error || "Login failed. Check your credentials.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("next") || "/metrics";
    } catch (err) {
      showError("Network error. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  });
});
