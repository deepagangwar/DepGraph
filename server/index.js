require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const db = require("./db");
const packagesRouter = require("./routes/packages");
const riskRouter = require("./routes/risk");
const pathRouter = require("./routes/path");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Every DB-backed route lives under /api. If CognoDB is unreachable we still
// want the static UI to load, so this only guards the API surface.
app.use("/api", (req, res, next) => {
  const lastError = db.getLastConnectivityError();
  if (lastError) {
    return res.status(503).json({
      error: "The graph database is unreachable right now.",
      detail: lastError.message,
      hint: "Check COGNODB_URI / COGNODB_USERNAME / COGNODB_PASSWORD in .env, and that the instance is running.",
    });
  }
  next();
});

app.use("/api/packages", packagesRouter);
app.use("/api/risk", riskRouter);
app.use("/api/path", pathRouter);

app.get("/api/health", async (req, res) => {
  const ok = await db.verifyConnectivity();
  res.status(ok ? 200 : 503).json({
    database: ok ? "connected" : "unreachable",
    error: ok ? null : db.getLastConnectivityError()?.message,
  });
});

// Fallback: single-page app, all non-API routes serve index.html.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Centralised error handler — never leaks stack traces to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong.", detail: err.message });
});

async function start() {
  const connected = await db.verifyConnectivity();
  if (connected) {
    console.log("✔ Connected to CognoDB.");
  } else {
    console.warn(
      "⚠ Could not connect to CognoDB at startup. The UI will still load, " +
        "but API requests will return 503 until the connection is fixed.\n" +
        `  Reason: ${db.getLastConnectivityError()?.message}`
    );
  }

  app.listen(PORT, () => {
    console.log(`DepGraph server listening on http://localhost:${PORT}`);
  });
}

start();

process.on("SIGINT", async () => {
  await db.close();
  process.exit(0);
});
module.exports = app;