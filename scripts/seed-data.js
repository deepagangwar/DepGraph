
const ADJ = [
  "micro", "tiny", "swift", "fast", "safe", "lazy", "async", "pure",
  "simple", "core", "flex", "smart", "auto", "raw", "solid", "light",
  "deep", "clean", "sharp", "quiet",
];
const DOMAIN = [
  "parse", "fetch", "route", "render", "cache", "queue", "stream",
  "hash", "token", "schema", "form", "date", "color", "grid", "log",
  "test", "build", "lint", "auth", "socket", "event", "state", "style",
  "type", "diff", "clone", "merge", "walk", "tree", "graph", "http",
  "url", "path", "file", "env", "config", "css", "dom", "array", "math",
];
const SUFFIX = [
  "js", "kit", "core", "lib", "utils", "helper", "engine", "tools",
  "", "", "", "",
];

const PEOPLE_FIRST = [
  "Amara", "Kenji", "Priya", "Liam", "Sofia", "Noah", "Yuki", "Elena",
  "Omar", "Grace", "Tariq", "Maya", "Felix", "Ines", "Diego", "Nina",
  "Ravi", "Zoe", "Lucas", "Aisha", "Marco", "Hana", "Theo", "Layla",
  "Ivan", "Sara", "Kofi", "Mila", "Aran", "Freya", "Boris", "Wren",
];
const PEOPLE_LAST = [
  "Okoye", "Nakamura", "Sharma", "Novak", "Reyes", "Petrov", "Lindqvist",
  "Haddad", "Costa", "Kowalski", "Chen", "Dubois", "Fischer", "Adeyemi",
  "Moreau", "Larsen", "Osei", "Ibarra", "Tanaka", "Bakker",
];

const ORG_NAMES = [
  "Northwind Systems", "Basalt Labs", "Fernway Software", "Cobalt Grid",
  "Harbor Nine", "Quiet River Tech", "Ferrous Cloud", "Loom & Co",
  "Vantage Point", "Redshift Collective", "Driftwood Digital",
  "Ampersand Studio", "Lantern Works", "Cinder Systems", "Anchorpoint",
  "Slate & Ivy", "Outrigger Labs", "Marrow Software",
];

const SEVERITIES = ["low", "medium", "high", "critical"];
const VULN_KINDS = [
  "prototype pollution", "regular-expression denial of service",
  "path traversal", "arbitrary code execution via unsanitised input",
  "improper certificate validation", "insecure default configuration",
  "SQL injection in a query helper", "cross-site scripting in a template helper",
  "unbounded memory growth under crafted input", "authentication bypass",
];

function seededRandom(seed) {
  let s = seed;
  return function rand() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function buildPackageName(rand, usedNames) {
  let name;
  do {
    const parts = [pick(rand, ADJ), pick(rand, DOMAIN), pick(rand, SUFFIX)].filter(Boolean);
    name = parts.join("-");
    if (rand() < 0.15) name = "@" + pick(rand, ["core", "web", "labs", "toolset"]) + "/" + name;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

function generate({ packageCount = 180, personCount = 90, seed = 42 } = {}) {
  const rand = seededRandom(seed);
  const usedNames = new Set();

  // ---- People -------------------------------------------------------
  const people = [];
  const usedUsernames = new Set();
  for (let i = 0; i < personCount; i++) {
    const first = pick(rand, PEOPLE_FIRST);
    const last = pick(rand, PEOPLE_LAST);
    let username = (first[0] + last).toLowerCase() + Math.floor(rand() * 90 + 10);
    while (usedUsernames.has(username)) {
      username = (first[0] + last).toLowerCase() + Math.floor(rand() * 900 + 100);
    }
    usedUsernames.add(username);
    people.push({ name: `${first} ${last}`, username, avatarUrl: null });
  }

  // ---- Organizations --------------------------------------------------
  const organizations = ORG_NAMES.map((name) => ({ name }));

  // ---- Packages (topologically generated DAG) ------------------------
  const packages = [];
  for (let i = 0; i < packageCount; i++) {
    const name = buildPackageName(rand, usedNames);
    packages.push({
      name,
      ecosystem: "npm",
      description: `${pick(rand, ADJ)} ${pick(rand, DOMAIN)} utility for JavaScript projects`,
      stars: Math.floor(Math.pow(rand(), 2.2) * 40000),
      latestVersion: `${Math.floor(rand() * 5) + 1}.${Math.floor(rand() * 20)}.${Math.floor(rand() * 10)}`,
      __index: i,
    });
  }

  // ---- Dependency edges (DAG: only point to a lower index) -----------
  const dependsOn = [];
  for (let i = 0; i < packages.length; i++) {
    if (i < 12) continue; // keep a foundational layer with zero dependencies
    const depCount = Math.min(i, Math.floor(Math.pow(rand(), 1.6) * 5));
    const chosen = new Set();
    for (let k = 0; k < depCount; k++) {
      // bias toward lower-indexed (more foundational, more "popular") packages
      const target = Math.floor(Math.pow(rand(), 1.8) * i);
      chosen.add(target);
    }
    for (const t of chosen) {
      if (t === i) continue;
      dependsOn.push({
        from: packages[i].name,
        to: packages[t].name,
        versionRange: `^${packages[t].latestVersion.split(".")[0]}.0.0`,
        type: rand() < 0.85 ? "direct" : "dev",
      });
    }
  }

  // ---- Maintainers -----------------------------------------------------
  const maintains = [];
  for (const pkg of packages) {
    const maintainerCount = rand() < 0.4 ? 1 : Math.floor(rand() * 3) + 2; // 1, or 2-4
    const chosenPeople = new Set();
    for (let k = 0; k < maintainerCount; k++) {
      chosenPeople.add(pick(rand, people).username);
    }
    let sinceYear = 2016 + Math.floor(rand() * 9);
    for (const username of chosenPeople) {
      maintains.push({
        person: username,
        package: pkg.name,
        since: `${sinceYear}-0${Math.floor(rand() * 8) + 1}-0${Math.floor(rand() * 8) + 1}`,
      });
    }
  }

  // ---- Org membership + ownership --------------------------------------
  const memberOf = [];
  for (const person of people) {
    if (rand() < 0.45) {
      memberOf.push({ person: person.username, org: pick(rand, organizations).name });
    }
  }
  const owns = [];
  for (const pkg of packages) {
    if (rand() < 0.28) {
      owns.push({ org: pick(rand, organizations).name, package: pkg.name });
    }
  }

  // ---- Vulnerabilities ---------------------------------------------------
  const vulnerabilities = [];
  const affects = [];
  const vulnTargets = new Set();
  while (vulnTargets.size < 20) {
    vulnTargets.add(Math.floor(rand() * packages.length));
  }
  let vulnIndex = 1;
  for (const idx of vulnTargets) {
    const pkg = packages[idx];
    const severity = pick(rand, SEVERITIES);
    const kind = pick(rand, VULN_KINDS);
    const id = `DGSA-${String(2021 + Math.floor(rand() * 5)).slice(2)}-${String(vulnIndex).padStart(4, "0")}`;
    vulnIndex++;
    const publishedDate = `${2021 + Math.floor(rand() * 5)}-${String(Math.floor(rand() * 12) + 1).padStart(2, "0")}-${String(Math.floor(rand() * 27) + 1).padStart(2, "0")}`;
    vulnerabilities.push({
      id,
      severity,
      summary: `${kind[0].toUpperCase()}${kind.slice(1)} in ${pkg.name}`,
      publishedDate,
    });
    affects.push({
      vulnerability: id,
      package: pkg.name,
      fixedInVersion: `${pkg.latestVersion.split(".")[0]}.${Math.floor(rand() * 20) + 1}.0`,
    });
  }

  // strip internal helper field before returning
  const cleanPackages = packages.map(({ __index, ...rest }) => rest);

  return {
    people,
    organizations,
    packages: cleanPackages,
    dependsOn,
    maintains,
    memberOf,
    owns,
    vulnerabilities,
    affects,
  };
}

module.exports = { generate };
