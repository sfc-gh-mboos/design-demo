document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
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
    const username = document.getElementById("signupUsername").value.trim();
    const displayName = document.getElementById("signupDisplayName").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!username || !password) {
      showError("Username and password are required.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating profile...";
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username,
          password,
          display_name: displayName || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(body.error || "Could not create profile. Try again.");
        return;
      }
      window.location.href = "/metrics";
    } catch (err) {
      showError("Network error. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create profile";
    }
  });
});
