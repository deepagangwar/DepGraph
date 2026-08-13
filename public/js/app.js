// public/js/app.js
const { h, skeleton, emptyState, errorBox, link } = render;
const appEl = document.getElementById("app");

/* ------------------------------ connection status ------------------------ */
async function checkHealth() {
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  try {
    const res = await api.health();
    if (res.database === "connected") {
      dot.className = "status-dot ok";
      text.textContent = "CognoDB connected";
    } else {
      throw new Error(res.error || "unreachable");
    }
  } catch (err) {
    dot.className = "status-dot bad";
    text.textContent = "CognoDB unreachable";
  }
}
checkHealth();
setInterval(checkHealth, 30000);

/* ------------------------------ router ------------------------------------ */
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const params = new URLSearchParams(queryPart || "");
  return { path: pathPart, params };
}

async function router() {
  const { path, params } = parseHash();
  document.querySelectorAll(".topnav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === "/" ? path === "/" : path.startsWith(a.dataset.route));
  });

  appEl.innerHTML = "";
  window.scrollTo(0, 0);

  if (path === "/") return viewHome();
  if (path === "/risk") return viewRisk();
  if (path === "/path") return viewPath(params);
  if (path.startsWith("/package/")) return viewPackage(decodeURIComponent(path.slice("/package/".length)));

  appEl.appendChild(emptyState("—", "That page doesn't exist."));
}
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

function goToPackage(name) {
  location.hash = `#/package/${encodeURIComponent(name)}`;
}

/* ------------------------------ HOME --------------------------------------- */
async function viewHome() {
  const hero = h("section", { class: "hero" }, [
    h("p", { class: "hero-eyebrow" }, "DepGraph · dependency network explorer"),
    h("h1", {}, "Every install is a promise your dependencies keep."),
    h("p", { class: "lede" },
      "Search a package to see what it pulls in, who maintains it, and how far a vulnerability upstream could travel before it reaches you."
    ),
  ]);

  const input = h("input", {
    class: "search-input",
    type: "text",
    placeholder: "Find a package, e.g. lazy-merge-engine",
    autocomplete: "off",
  });
  const goBtn = h("button", { class: "btn" }, "Explore");
  const resultsBox = h("div", { class: "search-results", style: "display:none" });

  const searchRow = h("div", { class: "search-row" }, [input, goBtn]);
  hero.appendChild(searchRow);
  hero.appendChild(resultsBox);
  appEl.appendChild(hero);

  let debounceTimer = null;
  async function runSearch() {
    const term = input.value.trim();
    if (!term) {
      resultsBox.style.display = "none";
      return;
    }
    try {
      const { results } = await api.searchPackages(term);
      resultsBox.innerHTML = "";
      if (results.length === 0) {
        resultsBox.appendChild(
          h("div", { class: "search-result-row" }, [h("span", { class: "search-result-name" }, "No matches. Try a shorter term.")])
        );
      } else {
        results.forEach((p) => {
          const row = h(
            "div",
            { class: "search-result-row", onclick: () => goToPackage(p.name) },
            [
              h("span", { class: "search-result-name" }, p.name),
              h("span", { class: "search-result-stars" }, `★ ${p.stars.toLocaleString()}`),
            ]
          );
          resultsBox.appendChild(row);
        });
      }
      resultsBox.style.display = "block";
    } catch (err) {
      resultsBox.innerHTML = "";
      resultsBox.appendChild(errorBox(err));
      resultsBox.style.display = "block";
    }
  }
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 220);
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
  goBtn.addEventListener("click", runSearch);

  // stats strip
  const statStrip = h("div", { class: "stat-strip" });
  appEl.appendChild(statStrip);
  ["Packages", "People", "Vulnerabilities", "Dependency edges"].forEach((label) => {
    statStrip.appendChild(h("div", { class: "stat-cell" }, [h("div", { class: "skeleton" })]));
  });
  try {
    const stats = await api.getStats();
    statStrip.innerHTML = "";
    const cells = [
      ["Packages", stats.packages],
      ["Maintainers", stats.people],
      ["Open disruptions", stats.vulnerabilities],
      ["Dependency edges", stats.dependencyEdges],
    ];
    cells.forEach(([label, num]) => {
      statStrip.appendChild(
        h("div", { class: "stat-cell" }, [
          h("div", { class: "stat-num" }, String(num)),
          h("div", { class: "stat-label" }, label),
        ])
      );
    });
  } catch (err) {
    statStrip.innerHTML = "";
    statStrip.appendChild(errorBox(err));
  }

  const linksCard = h("div", { class: "card" }, [
    h("div", { class: "section-title" }, "Jump in"),
    h("div", { class: "stop-list" }, [
      h("div", { class: "stop-row" }, [
        h("span", { class: "stop-dot coral" }),
        h("span", { class: "stop-name" }, [link("View the risk dashboard — who's a single point of failure", "#/risk")]),
      ]),
      h("div", { class: "stop-row" }, [
        h("span", { class: "stop-dot violet" }),
        h("span", { class: "stop-name" }, [link("Find the shortest dependency path between two packages", "#/path")]),
      ]),
    ]),
  ]);
  appEl.appendChild(linksCard);
}

/* ------------------------------ PACKAGE DETAIL ------------------------------ */
async function viewPackage(name) {
  const header = h("div", { class: "card" }, [skeleton(3)]);
  appEl.appendChild(header);

  let pkg;
  try {
    ({ package: pkg } = await api.getPackage(name));
  } catch (err) {
    header.innerHTML = "";
    header.appendChild(errorBox(err));
    return;
  }

  header.innerHTML = "";
  header.appendChild(
    h("div", { class: "station-header" }, [
      h("div", {}, [
        h("div", { class: "station-name" }, pkg.name),
        h("p", { class: "station-desc" }, pkg.description),
        h("div", { class: "station-meta" }, [
          h("span", { class: "meta-chip" }, `v${pkg.latestVersion}`),
          h("span", { class: "meta-chip" }, pkg.ecosystem),
          h("span", { class: "meta-chip" }, `★ ${pkg.stars.toLocaleString()}`),
        ]),
      ]),
    ])
  );

  // graph panel
  const graphCard = h("div", { class: "card" }, [
    h("div", { class: "section-title" }, "Neighborhood map"),
    h("div", { id: "network-canvas" }),
  ]);
  appEl.appendChild(graphCard);
  api.getNeighborhood(name)
    .then((data) => {
      depgraphViz.render(document.getElementById("network-canvas"), data, (id) => goToPackage(id));
    })
    .catch((err) => {
      document.getElementById("network-canvas").replaceWith(errorBox(err));
    });

  // tabs
  const tabs = ["Dependencies", "Dependents", "Maintainers", "Disruptions"];
  const tabbar = h("div", { class: "tabbar" });
  const panel = h("div", { class: "card" });
  tabs.forEach((label, i) => {
    const btn = h("button", { class: "tab" + (i === 0 ? " active" : "") }, label);
    btn.addEventListener("click", () => {
      tabbar.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      loadTab(label);
    });
    tabbar.appendChild(btn);
  });
  appEl.appendChild(tabbar);
  appEl.appendChild(panel);

  async function loadTab(label) {
    panel.innerHTML = "";
    panel.appendChild(skeleton(4));
    try {
      if (label === "Dependencies") await renderDependencyTab(panel, name, "dependencies");
      if (label === "Dependents") await renderDependencyTab(panel, name, "dependents");
      if (label === "Maintainers") await renderMaintainersTab(panel, name);
      if (label === "Disruptions") await renderVulnTab(panel, name);
    } catch (err) {
      panel.innerHTML = "";
      panel.appendChild(errorBox(err));
    }
  }
  loadTab("Dependencies");
}

async function renderDependencyTab(panel, name, kind) {
  const fetchFn = kind === "dependencies" ? api.getDependencies : api.getDependents;
  const directLabel = kind === "dependencies" ? "depends directly on" : "packages that directly depend on this";
  const transLabel = kind === "dependencies"
    ? "everything pulled in transitively (2+ hops)"
    : "blast radius — everything affected transitively (2+ hops)";

  const [direct, transitive] = await Promise.all([fetchFn(name, false), fetchFn(name, true)]);

  panel.innerHTML = "";
  panel.appendChild(h("div", { class: "section-title" }, [
    "Direct", h("span", { class: "count-pill" }, String(direct.count)),
    " · ", directLabel,
  ]));
  panel.appendChild(renderStopList(direct.results, (r) => [
    h("span", { class: "stop-dot teal" }),
    h("span", { class: "stop-name" }, [link(r.package.name, `#/package/${encodeURIComponent(r.package.name)}`)]),
    h("span", { class: "stop-tag" }, r.versionRange || ""),
    h("span", { class: "stop-tag" }, r.type || ""),
  ], "No direct relationships here."));

  panel.appendChild(h("div", { class: "section-title", style: "margin-top:26px" }, [
    "Transitive", h("span", { class: "count-pill" }, String(transitive.count)),
    " · ", transLabel,
  ]));
  panel.appendChild(renderStopList(transitive.results, (r) => [
    h("span", { class: "stop-dot violet" }),
    h("span", { class: "stop-name" }, [link(r.package.name, `#/package/${encodeURIComponent(r.package.name)}`)]),
    h("span", { class: "stop-depth" }, `${r.depth} hop${r.depth > 1 ? "s" : ""}`),
  ], "Nothing beyond the direct set — this part of the graph is shallow."));
}

async function renderMaintainersTab(panel, name) {
  const [{ results: maintainers }, { results: coMaintainers }] = await Promise.all([
    api.getMaintainers(name),
    api.getCoMaintainers(name),
  ]);
  panel.innerHTML = "";
  panel.appendChild(h("div", { class: "section-title" }, ["Maintainers", h("span", { class: "count-pill" }, String(maintainers.length))]));
  panel.appendChild(renderStopList(maintainers, (m) => [
    h("span", { class: "stop-dot amber" }),
    h("span", { class: "stop-name" }, `${m.person.name} · @${m.person.username}`),
    h("span", { class: "stop-tag" }, m.organizations.length ? m.organizations.join(", ") : "independent"),
    h("span", { class: "stop-tag" }, `since ${m.since}`),
  ], "No listed maintainers."));

  if (maintainers.length === 1) {
    panel.appendChild(h("div", { class: "error-box", style: "margin-top:16px" }, [
      h("strong", {}, "Single point of failure. "),
      "Only one person maintains this package. See the ",
      link("risk dashboard", "#/risk"),
      " for how much of the graph depends on it.",
    ]));
  }

  panel.appendChild(h("div", { class: "section-title", style: "margin-top:26px" }, ["Also maintains, with", h("span", { class: "count-pill" }, String(coMaintainers.length))]));
  panel.appendChild(renderStopList(coMaintainers, (c) => [
    h("span", { class: "stop-dot violet" }),
    h("span", { class: "stop-name" }, `${c.person.name} · @${c.person.username}`),
    h("span", { class: "stop-tag" }, c.sharedPackages.join(", ")),
  ], "No overlapping maintainers found."));
}

async function renderVulnTab(panel, name) {
  const { direct, inherited, totalCount } = await api.getVulnerabilities(name);
  panel.innerHTML = "";
  panel.appendChild(h("div", { class: "section-title" }, ["Total open disruptions", h("span", { class: "count-pill" }, String(totalCount))]));

  if (totalCount === 0) {
    panel.appendChild(emptyState("✓", "No known vulnerabilities, direct or inherited, for this package."));
    return;
  }

  const list = h("div", { class: "stop-list" });
  direct.forEach((d) => list.appendChild(vulnRow(d.vulnerability, d.fixedInVersion, null)));
  inherited.forEach((d) => list.appendChild(vulnRow(d.vulnerability, d.fixedInVersion, d.throughPackage)));
  panel.appendChild(list);
}

function vulnRow(v, fixedInVersion, throughPackage) {
  return h("div", { class: `stop-row vuln-row sev-${v.severity}` }, [
    h("div", { style: "flex:1" }, [
      h("div", {}, [
        h("span", { class: `sev-badge sev-${v.severity}` }, v.severity),
        h("span", { class: "vuln-id" }, v.id),
      ]),
      h("div", { class: "vuln-summary" }, v.summary),
      h("div", { class: "vuln-id" }, throughPackage
        ? `Inherited via ${throughPackage} · fixed in ${fixedInVersion}`
        : `Direct · fixed in ${fixedInVersion}`),
    ]),
  ]);
}

function renderStopList(items, rowFn, emptyMessage) {
  if (!items || items.length === 0) return emptyState("·", emptyMessage);
  const list = h("div", { class: "stop-list" });
  items.forEach((item) => list.appendChild(h("div", { class: "stop-row" }, rowFn(item))));
  return list;
}

/* ------------------------------ RISK DASHBOARD ------------------------------ */
async function viewRisk() {
  const intro = h("section", { class: "hero" }, [
    h("p", { class: "hero-eyebrow" }, "Service disruptions board"),
    h("h1", {}, "Single points of failure"),
    h("p", { class: "lede" },
      "Packages maintained by exactly one person, ranked by how many other packages would feel it — directly or transitively — if that person stepped away."
    ),
  ]);
  appEl.appendChild(intro);

  const boardCard = h("div", { class: "card" });
  appEl.appendChild(boardCard);
  boardCard.appendChild(skeleton(6));

  try {
    const { results } = await api.getBusFactorRisk();
    boardCard.innerHTML = "";
    const board = h("div", { class: "board" });
    board.appendChild(
      h("div", { class: "board-row head" }, [
        h("span", {}, "#"),
        h("span", {}, "Package"),
        h("span", {}, "Sole maintainer"),
        h("span", {}, "Downstream"),
      ])
    );
    results.forEach((r, i) => {
      board.appendChild(
        h("div", { class: "board-row" + (r.downstreamCount >= 10 ? " risk-hot" : "") }, [
          h("span", { class: "board-rank" }, String(i + 1)),
          h("span", { class: "board-pkg" }, [link(r.package.name, `#/package/${encodeURIComponent(r.package.name)}`)]),
          h("span", { class: "board-maintainer" }, r.soleMaintainer),
          h("span", { class: "board-count" }, String(r.downstreamCount)),
        ])
      );
    });
    boardCard.appendChild(board);
    if (results.length === 0) {
      boardCard.appendChild(emptyState("✓", "No single-maintainer packages found."));
    }
  } catch (err) {
    boardCard.innerHTML = "";
    boardCard.appendChild(errorBox(err));
  }
}

/* ------------------------------ PATH FINDER --------------------------------- */
async function viewPath(params) {
  const intro = h("section", { class: "hero" }, [
    h("p", { class: "hero-eyebrow" }, "Route finder"),
    h("h1", {}, "How does A reach B?"),
    h("p", { class: "lede" }, "Find the shortest chain of dependencies connecting two packages."),
  ]);
  appEl.appendChild(intro);

  const fromInput = h("input", { class: "search-input", placeholder: "from package", value: params.get("from") || "" });
  const toInput = h("input", { class: "search-input", placeholder: "to package", value: params.get("to") || "" });
  const goBtn = h("button", { class: "btn" }, "Find route");
  const form = h("div", { class: "card path-form" }, [fromInput, h("span", { class: "path-arrow" }, "→"), toInput, goBtn]);
  appEl.appendChild(form);

  const resultCard = h("div", { class: "card", style: "margin-top:20px; display:none" });
  appEl.appendChild(resultCard);

  async function run() {
    const from = fromInput.value.trim();
    const to = toInput.value.trim();
    if (!from || !to) return;
    location.hash = `#/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    resultCard.style.display = "block";
    resultCard.innerHTML = "";
    resultCard.appendChild(skeleton(2));
    try {
      const data = await api.getPath(from, to);
      resultCard.innerHTML = "";
      if (!data.found) {
        resultCard.appendChild(emptyState("×", `No dependency path found from "${from}" to "${to}" within the search depth.`));
        return;
      }
      resultCard.appendChild(h("div", { class: "section-title" }, `${data.nodes.length - 1} hop${data.nodes.length - 1 === 1 ? "" : "s"}`));
      const track = h("div", { class: "path-track" });
      data.nodes.forEach((node, i) => {
        track.appendChild(
          h("div", { class: "path-node" }, [
            h("span", { class: "stop-dot " + (i === 0 || i === data.nodes.length - 1 ? "coral" : "teal") }),
            h("span", { class: "path-label" }, [link(node.name, `#/package/${encodeURIComponent(node.name)}`)]),
          ])
        );
        if (i < data.nodes.length - 1) {
          track.appendChild(h("div", { class: "path-seg" }, [h("span", { class: "range" }, data.ranges[i] || "")]));
        }
      });
      resultCard.appendChild(track);
    } catch (err) {
      resultCard.innerHTML = "";
      resultCard.appendChild(errorBox(err));
    }
  }

  goBtn.addEventListener("click", run);
  [fromInput, toInput].forEach((inp) => inp.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); }));

  if (params.get("from") && params.get("to")) run();
}
