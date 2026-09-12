/**
 * Path Graph Builder — constructs a graph of pages and button actions.
 * Tracks nodes (pages/states) and edges (button clicks that lead to destinations).
 */

/**
 * Creates a new empty path graph.
 * @returns {{ nodes: Array, edges: Array }}
 */
export function createPathGraph() {
  return {
    nodes: [],
    edges: [],
  };
}

/**
 * Adds a node to the graph if it doesn't already exist.
 * @param {Object} graph
 * @param {string} url
 * @param {Object} [meta={}]
 */
export function addNode(graph, url, meta = {}) {
  const existing = graph.nodes.find((n) => n.url === url);
  if (!existing) {
    graph.nodes.push({
      url,
      ...meta,
      visited: false,
    });
  } else if (Object.keys(meta).length > 0) {
    Object.assign(existing, meta);
  }
}

/**
 * Adds an edge to the graph connecting a source URL to a target via a button action.
 * @param {Object} graph
 * @param {string} source
 * @param {string} target
 * @param {string} buttonText
 * @param {'navigation'|'client_route'|'dom_mutation'} type
 */
export function addEdge(graph, source, target, buttonText, type) {
  const exists = graph.edges.some(
    (e) => e.source === source && e.target === target && e.buttonText === buttonText && e.type === type
  );
  if (!exists) {
    graph.edges.push({
      source,
      target,
      action: 'click',
      buttonText,
      type,
    });
  }

  // Ensure both nodes exist
  addNode(graph, source);
  addNode(graph, target);
}

/**
 * Marks a node as visited.
 * @param {Object} graph
 * @param {string} url
 */
export function markVisited(graph, url) {
  const node = graph.nodes.find((n) => n.url === url);
  if (node) {
    node.visited = true;
  }
}

/**
 * Serializes the path graph to JSON.
 * @param {Object} graph
 * @returns {string}
 */
export function serializeGraph(graph) {
  return JSON.stringify(graph, null, 2);
}

/**
 * Generates a state-changed target URL for DOM mutations.
 * @param {string} currentUrl
 * @param {string} buttonText
 * @returns {string}
 */
export function generateStateChangedUrl(currentUrl, buttonText) {
  const stateSuffix = `#state-changed-${buttonText.replace(/\s+/g, '-').toLowerCase()}`;
  return `${currentUrl}${stateSuffix}`;
}
