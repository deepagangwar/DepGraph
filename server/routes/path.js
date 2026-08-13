const express = require("express");
const { runQuery } = require("../db");
const { queries } = require("../queries/cypher");

const router = express.Router();

function nodeToJson(node) {
  if (!node) return null;
  return { ...node.properties, _labels: node.labels };
}

// GET /api/path?from=express&to=lodash
router.get("/", async (req, res, next) => {
  try {
    const from = (req.query.from || "").trim();
    const to = (req.query.to || "").trim();
    if (!from || !to) {
      return res.status(400).json({ error: "Both `from` and `to` package names are required." });
    }
    const records = await runQuery(queries.getShortestPath, { from, to });
    if (records.length === 0) {
      return res.json({ found: false, nodes: [], ranges: [] });
    }
    const record = records[0];
    const nodes = record.get("nodes").map(nodeToJson);
    const ranges = record.get("ranges");
    res.json({ found: true, nodes, ranges });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
