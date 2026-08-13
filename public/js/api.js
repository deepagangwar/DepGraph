// public/js/api.js
// Thin wrapper around the backend REST API. Every function returns a
// parsed JSON body or throws an Error with a message safe to show
// directly in the UI (the server never leaks stack traces).

const api = (() => {
  async function request(path) {
    let res;
    try {
      res = await fetch(path);
    } catch (networkErr) {
      throw new Error("Could not reach the DepGraph server. Is it running?");
    }
    let body;
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (!res.ok) {
      const msg = body.error || `Request failed (${res.status})`;
      const detail = body.detail ? ` — ${body.detail}` : "";
      throw new Error(msg + detail);
    }
    return body;
  }

  return {
    health: () => request("/api/health"),
    searchPackages: (term) => request(`/api/packages/search?q=${encodeURIComponent(term)}`),
    getPackage: (name) => request(`/api/packages/${encodeURIComponent(name)}`),
    getDependencies: (name, transitive) =>
      request(`/api/packages/${encodeURIComponent(name)}/dependencies?transitive=${!!transitive}`),
    getDependents: (name, transitive) =>
      request(`/api/packages/${encodeURIComponent(name)}/dependents?transitive=${!!transitive}`),
    getMaintainers: (name) => request(`/api/packages/${encodeURIComponent(name)}/maintainers`),
    getVulnerabilities: (name) => request(`/api/packages/${encodeURIComponent(name)}/vulnerabilities`),
    getCoMaintainers: (name) => request(`/api/packages/${encodeURIComponent(name)}/co-maintainers`),
    getNeighborhood: (name) => request(`/api/packages/${encodeURIComponent(name)}/neighborhood`),
    getBusFactorRisk: () => request(`/api/risk/bus-factor`),
    getStats: () => request(`/api/risk/stats`),
    getPath: (from, to) =>
      request(`/api/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  };
})();
