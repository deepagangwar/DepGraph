// public/js/render.js
// Small helpers for building DOM safely (no innerHTML with untrusted
// strings) and for the loading / empty / error state patterns reused
// across every view.

const render = (() => {
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v; // only ever used with static, trusted strings
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) el.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined) continue;
      el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return el;
  }

  function skeleton(lines = 3) {
    const wrap = h("div");
    for (let i = 0; i < lines; i++) {
      wrap.appendChild(h("div", { class: "skeleton", style: `width:${90 - i * 12}%` }));
    }
    return wrap;
  }

  function emptyState(glyph, message) {
    return h("div", { class: "empty-state" }, [
      h("span", { class: "glyph" }, glyph),
      h("span", {}, message),
    ]);
  }

  function errorBox(err) {
    return h("div", { class: "error-box" }, [
      h("strong", {}, "Couldn't load this. "),
      h("span", {}, err.message || String(err)),
    ]);
  }

  function link(text, href) {
    return h("a", { href }, text);
  }

  return { h, skeleton, emptyState, errorBox, link };
})();
