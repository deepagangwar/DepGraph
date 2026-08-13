// public/js/graph.js
// Renders the package neighborhood using vis-network, styled to read as
// a small transit map: the viewed package is the interchange station,
// dependencies and dependents are colour-coded by direction.

const depgraphViz = (() => {
  function render(container, { nodes, edges }, onNodeClick) {
    container.innerHTML = "";

    const colorFor = (group) => {
      if (group === "center") return { border: "#e8a33d", background: "#3a2c12", font: "#eceef1" };
      if (group === "dependency") return { border: "#3fa7a0", background: "#132523", font: "#cfe9e6" };
      return { border: "#8b7fd6", background: "#221f36", font: "#ded9f6" };
    };

    const visNodes = new vis.DataSet(
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        shape: "dot",
        size: n.group === "center" ? 22 : 14,
        color: colorFor(n.group),
        font: { color: "#eceef1", face: "IBM Plex Mono", size: 12 },
      }))
    );
    const visEdges = new vis.DataSet(
      edges.map((e) => ({
        from: e.from,
        to: e.to,
        arrows: "to",
        color: { color: "#3a4452", highlight: "#e8a33d" },
        smooth: { type: "curvedCW", roundness: 0.15 },
        width: 1.4,
      }))
    );

    const network = new vis.Network(
      container,
      { nodes: visNodes, edges: visEdges },
      {
        physics: {
          solver: "forceAtlas2Based",
          forceAtlas2Based: { gravitationalConstant: -60, springLength: 90, springConstant: 0.06 },
          stabilization: { iterations: 120 },
        },
        interaction: { hover: true, tooltipDelay: 100 },
        nodes: { borderWidth: 2 },
      }
    );

    if (onNodeClick) {
      network.on("click", (params) => {
        if (params.nodes.length) onNodeClick(params.nodes[0]);
      });
    }
    return network;
  }

  return { render };
})();
