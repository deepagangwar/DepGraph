
const MAX_HOPS = 6;

const queries = {
  // Autocomplete / search. 1 hop from nothing — just a node scan by prefix.
  searchPackages: `
    MATCH (p:Package)
    WHERE toLower(p.name) CONTAINS toLower($term)
    RETURN p
    ORDER BY p.stars DESC
    LIMIT 12
  `,

  // Single package by exact name.
  getPackage: `
    MATCH (p:Package {name: $name})
    RETURN p
  `,

  // 1-hop: direct dependencies, with the edge properties.
  getDirectDependencies: `
    MATCH (p:Package {name: $name})-[r:DEPENDS_ON]->(d:Package)
    RETURN d, r.versionRange AS versionRange, r.type AS type
    ORDER BY d.name
  `,

  // 1-hop: direct dependents (who depends on this package).
  getDirectDependents: `
    MATCH (p:Package {name: $name})<-[r:DEPENDS_ON]-(d:Package)
    RETURN d, r.versionRange AS versionRange, r.type AS type
    ORDER BY d.name
  `,

  // Multi-hop (2+): full transitive dependency tree — everything this
  // package pulls in, directly or through other packages. A relational
  // schema needs a recursive CTE (and a manual cycle guard) for this;
  // here it is one variable-length pattern.
  getTransitiveDependencies: `
    MATCH path = (p:Package {name: $name})-[:DEPENDS_ON*1..${MAX_HOPS}]->(d:Package)
    WITH d, min(length(path)) AS depth
    RETURN d, depth
    ORDER BY depth ASC, d.name ASC
  `,

  // Multi-hop (2+): "blast radius" — every package that would be affected,
  // directly or transitively, if this package broke or was removed.
  getTransitiveDependents: `
    MATCH path = (p:Package {name: $name})<-[:DEPENDS_ON*1..${MAX_HOPS}]-(d:Package)
    WITH d, min(length(path)) AS depth
    RETURN d, depth
    ORDER BY depth ASC, d.name ASC
  `,

  getMaintainers: `
    MATCH (person:Person)-[r:MAINTAINS]->(p:Package {name: $name})
    OPTIONAL MATCH (person)-[:MEMBER_OF]->(org:Organization)
    RETURN person, r.since AS since, collect(org.name) AS orgs
    ORDER BY r.since ASC
  `,

  // Vulnerabilities that hit this exact package.
  getDirectVulnerabilities: `
    MATCH (v:Vulnerability)-[a:AFFECTS]->(p:Package {name: $name})
    RETURN v, a.fixedInVersion AS fixedInVersion
    ORDER BY v.severity DESC
  `,

  // Multi-hop (2+), relationally awkward: vulnerabilities inherited through
  // the dependency tree — i.e. any vulnerability whose affected package is
  // somewhere upstream of the one being viewed. In SQL this is a recursive
  // join fanned out per severity row; in Cypher it is one traversal.
  getInheritedVulnerabilities: `
    MATCH (p:Package {name: $name})-[:DEPENDS_ON*1..${MAX_HOPS}]->(upstream:Package)
          <-[a:AFFECTS]-(v:Vulnerability)
    RETURN DISTINCT v, upstream.name AS throughPackage, a.fixedInVersion AS fixedInVersion
    ORDER BY v.severity DESC
  `,

  // Relationally awkward aggregate: single-maintainer packages ranked by how
  // many other packages transitively depend on them. This is the "if this
  // one person disappears, how much of the ecosystem is at risk" query —
  // it combines a group-by-having (maintainer count = 1) with a variable
  // length transitive count, which needs two nested recursive CTEs in SQL
  // and is one query here.
  getBusFactorRisk: `
    MATCH (p:Package)<-[:MAINTAINS]-(person:Person)
    WITH p, collect(person.name) AS maintainers
    WHERE size(maintainers) = 1
    OPTIONAL MATCH (p)<-[:DEPENDS_ON*1..${MAX_HOPS}]-(dependent:Package)
    WITH p, maintainers[0] AS soleMaintainer, count(DISTINCT dependent) AS downstreamCount
    RETURN p, soleMaintainer, downstreamCount
    ORDER BY downstreamCount DESC, p.stars DESC
    LIMIT 25
  `,

  // Shortest dependency path between two named packages (any direction is
  // not needed here — dependency edges are directed, so this finds how A
  // eventually pulls in B).
  getShortestPath: `
    MATCH (a:Package {name: $from}), (b:Package {name: $to})
    MATCH path = shortestPath((a)-[:DEPENDS_ON*..${MAX_HOPS + 4}]->(b))
    RETURN [n IN nodes(path) | n] AS nodes,
           [r IN relationships(path) | r.versionRange] AS ranges
  `,

  // People who co-maintain a package with this package's maintainers —
  // used to surface "who else touches this part of the ecosystem".
  getCoMaintainers: `
    MATCH (p:Package {name: $name})<-[:MAINTAINS]-(me:Person)
          -[:MAINTAINS]->(other:Package)<-[:MAINTAINS]-(peer:Person)
    WHERE peer <> me
    RETURN DISTINCT peer, collect(DISTINCT other.name)[0..5] AS sharedPackages
    LIMIT 10
  `,

  getEcosystemStats: `
    MATCH (p:Package)
    WITH count(p) AS packages
    MATCH (person:Person)
    WITH packages, count(person) AS people
    MATCH (v:Vulnerability)
    WITH packages, people, count(v) AS vulns
    MATCH ()-[r:DEPENDS_ON]->()
    RETURN packages, people, vulns, count(r) AS edges
  `,

  // Small subgraph (package + direct deps + direct dependents) shaped for
  // the network visualisation panel.
  getNeighborhood: `
    MATCH (p:Package {name: $name})
    OPTIONAL MATCH (p)-[:DEPENDS_ON]->(dep:Package)
    OPTIONAL MATCH (p)<-[:DEPENDS_ON]-(dependent:Package)
    RETURN p,
           collect(DISTINCT dep) AS deps,
           collect(DISTINCT dependent) AS dependents
  `,
};

module.exports = { queries, MAX_HOPS };
