const express = require("express");
const { runQuery } = require("../db");
const { queries } = require("../queries/cypher");

const router = express.Router();

function nodeToJson(node) {
  if (!node) return null;
  return { ...node.properties, _labels: node.labels };
}

// GET /api/packages/search?q=exp
router.get("/search", async (req, res, next) => {
  try {
    const term = (req.query.q || "").trim();
    if (!term) return res.json({ results: [] });
    const records = await runQuery(queries.searchPackages, { term });
    const results = records.map((r) => nodeToJson(r.get("p")));
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:name
router.get("/:name", async (req, res, next) => {
  try {
    const { name } = req.params;
    const records = await runQuery(queries.getPackage, { name });
    if (records.length === 0) {
      return res.status(404).json({ error: `No package named "${name}".` });
    }
    res.json({ package: nodeToJson(records[0].get("p")) });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:name/dependencies?transitive=true
router.get("/:name/dependencies", async (req, res, next) => {
  try {
    const { name } = req.params;
    const transitive = req.query.transitive === "true";
    const records = await runQuery(
      transitive ? queries.getTransitiveDependencies : queries.getDirectDependencies,
      { name }
    );
    const results = records.map((r) => ({
      package: nodeToJson(r.get("d")),
      ...(transitive
        ? { depth: r.get("depth") }
        : { versionRange: r.get("versionRange"), type: r.get("type") }),
    }));
    res.json({ transitive, count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:name/dependents?transitive=true
router.get("/:name/dependents", async (req, res, next) => {
  try {
    const { name } = req.params;
    const transitive = req.query.transitive === "true";
    const records = await runQuery(
      transitive ? queries.getTransitiveDependents : queries.getDirectDependents,
      { name }
    );
    const results = records.map((r) => ({
      package: nodeToJson(r.get("d")),
      ...(transitive
        ? { depth: r.get("depth") }
        : { versionRange: r.get("versionRange"), type: r.get("type") }),
    }));
    res.json({ transitive, count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:name/maintainers
router.get("/:name/maintainers", async (req, res, next) => {
  try {
    const { name } = req.params;
    const records = await runQuery(queries.getMaintainers, { name });
    const results = records.map((r) => ({
      person: nodeToJson(r.get("person")),
      since: r.get("since"),
      organizations: r.get("orgs").filter(Boolean),
    }));
    res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:name/vulnerabilities  -> direct + inherited
router.get("/:name/vulnerabilities", async (req, res, next) => {
  try {
    const { name } = req.params;
    const [directRecords, inheritedRecords] = await Promise.all([
      runQuery(queries.getDirectVulnerabilities, { name }),
      runQuery(queries.getInheritedVulnerabilities, { name }),
    ]);

    const direct = directRecords.map((r) => ({
      vulnerability: nodeToJson(r.get("v")),
      fixedInVersion: r.get("fixedInVersion"),
      throughPackage: null,
    }));

    const inherited = inheritedRecords.map((r) => ({
      vulnerability: nodeToJson(r.get("v")),
      fixedInVersion: r.get("fixedInVersion"),
      throughPackage: r.get("throughPackage"),
    }));

    res.json({ direct, inherited, totalCount: direct.length + inherited.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:name/co-maintainers
router.get("/:name/co-maintainers", async (req, res, next) => {
  try {
    const { name } = req.params;
    const records = await runQuery(queries.getCoMaintainers, { name });
    const results = records.map((r) => ({
      person: nodeToJson(r.get("peer")),
      sharedPackages: r.get("sharedPackages"),
    }));
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:name/neighborhood  -> shaped for the graph visual
router.get("/:name/neighborhood", async (req, res, next) => {
  try {
    const { name } = req.params;
    const records = await runQuery(queries.getNeighborhood, { name });
    if (records.length === 0) {
      return res.status(404).json({ error: `No package named "${name}".` });
    }
    const record = records[0];
    const center = nodeToJson(record.get("p"));
    const deps = record.get("deps").filter(Boolean).map(nodeToJson);
    const dependents = record.get("dependents").filter(Boolean).map(nodeToJson);

    const nodes = [
      { id: center.name, label: center.name, group: "center" },
      ...deps.map((d) => ({ id: d.name, label: d.name, group: "dependency" })),
      ...dependents.map((d) => ({ id: d.name, label: d.name, group: "dependent" })),
    ];
    const edges = [
      ...deps.map((d) => ({ from: center.name, to: d.name })),
      ...dependents.map((d) => ({ from: d.name, to: center.name })),
    ];

    res.json({ nodes, edges });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
