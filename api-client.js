(() => {
  function buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    });
    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
  }

  async function requestJson(path, options = {}) {
    const { method = "GET", data, headers = {} } = options;
    const response = await fetch(path, {
      method,
      headers: {
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json().catch(() => ({})) : {};

    if (!response.ok) {
      const message = payload.error || response.statusText || "Request failed";
      throw new Error(message);
    }

    return payload;
  }

  window.ApiClient = {
    buildQuery,
    requestJson,
  };
})();
