const express = require("express");
const { runQuery } = require("../db");
const { queries } = require("../queries/cypher");

const router = express.Router();

function nodeToJson(node) {
  if (!node) return null;
  return { ...node.properties, _labels: node.labels };
}

// GET /api/risk/bus-factor
// Single-maintainer packages ranked by how many other packages would feel
// it, transitively, if that one maintainer walked away.
router.get("/bus-factor", async (req, res, next) => {
  try {
    const records = await runQuery(queries.getBusFactorRisk);
    const results = records.map((r) => ({
      package: nodeToJson(r.get("p")),
      soleMaintainer: r.get("soleMaintainer"),
      downstreamCount: r.get("downstreamCount"),
    }));
    res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// GET /api/risk/stats
router.get("/stats", async (req, res, next) => {
  try {
    const records = await runQuery(queries.getEcosystemStats);
    const r = records[0];
    res.json({
      packages: r.get("packages"),
      people: r.get("people"),
      vulnerabilities: r.get("vulns"),
      dependencyEdges: r.get("edges"),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
