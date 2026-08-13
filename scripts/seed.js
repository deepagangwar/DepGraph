
require("dotenv").config();
const { runWriteTransaction, close, verifyConnectivity, getLastConnectivityError } = require("../server/db");
const { generate } = require("./seed-data");

async function main() {
  console.log("Connecting to CognoDB...");
  const ok = await verifyConnectivity();
  if (!ok) {
    console.error("✘ Could not connect to CognoDB.");
    console.error(`  ${getLastConnectivityError()?.message}`);
    console.error("  Check .env against .env.example and confirm the instance is running.");
    process.exit(1);
  }
  console.log("✔ Connected.");

  const data = generate({ packageCount: 180, personCount: 90, seed: 42 });

  console.log("Clearing existing data...");
  await runWriteTransaction((tx) => tx.run("MATCH (n) DETACH DELETE n"));

  console.log("Creating constraints...");
  await runWriteTransaction((tx) =>
    tx.run("CREATE CONSTRAINT package_name IF NOT EXISTS FOR (p:Package) REQUIRE p.name IS UNIQUE")
  );
  await runWriteTransaction((tx) =>
    tx.run("CREATE CONSTRAINT person_username IF NOT EXISTS FOR (p:Person) REQUIRE p.username IS UNIQUE")
  );
  await runWriteTransaction((tx) =>
    tx.run("CREATE CONSTRAINT org_name IF NOT EXISTS FOR (o:Organization) REQUIRE o.name IS UNIQUE")
  );
  await runWriteTransaction((tx) =>
    tx.run("CREATE CONSTRAINT vuln_id IF NOT EXISTS FOR (v:Vulnerability) REQUIRE v.id IS UNIQUE")
  );

  console.log(`Loading ${data.packages.length} packages...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       CREATE (p:Package {name: row.name, ecosystem: row.ecosystem,
         description: row.description, stars: row.stars, latestVersion: row.latestVersion})`,
      { rows: data.packages }
    )
  );

  console.log(`Loading ${data.people.length} people...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       CREATE (p:Person {name: row.name, username: row.username})`,
      { rows: data.people }
    )
  );

  console.log(`Loading ${data.organizations.length} organizations...`);
  await runWriteTransaction((tx) =>
    tx.run(`UNWIND $rows AS row CREATE (o:Organization {name: row.name})`, {
      rows: data.organizations,
    })
  );

  console.log(`Loading ${data.vulnerabilities.length} vulnerabilities...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       CREATE (v:Vulnerability {id: row.id, severity: row.severity,
         summary: row.summary, publishedDate: row.publishedDate})`,
      { rows: data.vulnerabilities }
    )
  );

  console.log(`Loading ${data.dependsOn.length} DEPENDS_ON edges...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       MATCH (a:Package {name: row.from}), (b:Package {name: row.to})
       CREATE (a)-[:DEPENDS_ON {versionRange: row.versionRange, type: row.type}]->(b)`,
      { rows: data.dependsOn }
    )
  );

  console.log(`Loading ${data.maintains.length} MAINTAINS edges...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       MATCH (person:Person {username: row.person}), (p:Package {name: row.package})
       CREATE (person)-[:MAINTAINS {since: row.since}]->(p)`,
      { rows: data.maintains }
    )
  );

  console.log(`Loading ${data.memberOf.length} MEMBER_OF edges...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       MATCH (person:Person {username: row.person}), (o:Organization {name: row.org})
       CREATE (person)-[:MEMBER_OF]->(o)`,
      { rows: data.memberOf }
    )
  );

  console.log(`Loading ${data.owns.length} OWNS edges...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       MATCH (o:Organization {name: row.org}), (p:Package {name: row.package})
       CREATE (o)-[:OWNS]->(p)`,
      { rows: data.owns }
    )
  );

  console.log(`Loading ${data.affects.length} AFFECTS edges...`);
  await runWriteTransaction((tx) =>
    tx.run(
      `UNWIND $rows AS row
       MATCH (v:Vulnerability {id: row.vulnerability}), (p:Package {name: row.package})
       CREATE (v)-[:AFFECTS {fixedInVersion: row.fixedInVersion}]->(p)`,
      { rows: data.affects }
    )
  );

  console.log("\n✔ Seed complete:");
  console.log(`  ${data.packages.length} packages, ${data.people.length} people, ${data.organizations.length} orgs, ${data.vulnerabilities.length} vulnerabilities`);
  console.log(`  ${data.dependsOn.length} DEPENDS_ON, ${data.maintains.length} MAINTAINS, ${data.memberOf.length} MEMBER_OF, ${data.owns.length} OWNS, ${data.affects.length} AFFECTS`);

  await close();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await close();
  process.exit(1);
});
