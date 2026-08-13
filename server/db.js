
const neo4j = require("neo4j-driver");

let driver = null;
let connectivityError = null;

function getDriver() {
  if (driver) return driver;

  const { COGNODB_URI, COGNODB_USERNAME, COGNODB_PASSWORD } = process.env;

  if (!COGNODB_URI || !COGNODB_USERNAME || !COGNODB_PASSWORD) {
    throw new Error(
      "Missing CognoDB connection details. Set COGNODB_URI, COGNODB_USERNAME " +
        "and COGNODB_PASSWORD (see .env.example)."
    );
  }

  driver = neo4j.driver(
    COGNODB_URI,
    neo4j.auth.basic(COGNODB_USERNAME, COGNODB_PASSWORD),
    { disableLosslessIntegers: true }
  );

  return driver;
}

// Verifies the instance is reachable. Called once at boot so the server can
async function verifyConnectivity() {
  try {
    const d = getDriver();
    await d.verifyConnectivity();
    connectivityError = null;
    return true;
  } catch (err) {
    connectivityError = err;
    return false;
  }
}

function getLastConnectivityError() {
  return connectivityError;
}

// Runs a single Cypher statement inside a managed session and always
// releases the session, even if the query throws.
async function runQuery(cypher, params = {}, { write = false } = {}) {
  const d = getDriver();
  const session = d.session({
    defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ,
  });
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

// Runs several statements in one write transaction (used by the seed script).
async function runWriteTransaction(work) {
  const d = getDriver();
  const session = d.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

async function close() {
  if (driver) await driver.close();
}

module.exports = {
  getDriver,
  verifyConnectivity,
  getLastConnectivityError,
  runQuery,
  runWriteTransaction,
  close,
};
