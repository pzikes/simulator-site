import { DEVICE_TYPES, VIEWBOX } from "./network.js";

const STORAGE_KEY = "sitovy-simulator.network.v1";

export function saveNetwork(network, storageProvider = getBrowserStorage) {
  if (!isValidNetwork(network)) {
    return { ok: false, error: "invalid-network" };
  }

  try {
    const storage = storageProvider();
    if (!storage) {
      return { ok: false, error: "unavailable" };
    }

    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      nodes: network.nodes,
      edges: network.edges,
    }));
    return { ok: true };
  } catch {
    return { ok: false, error: "write-failed" };
  }
}

export function loadNetwork(storageProvider = getBrowserStorage) {
  let serialized;
  try {
    const storage = storageProvider();
    if (!storage) {
      return { ok: false, error: "unavailable" };
    }
    serialized = storage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, error: "read-failed" };
  }

  if (serialized === null) {
    return { ok: false, error: "not-found" };
  }

  try {
    const parsed = JSON.parse(serialized);
    if (parsed?.version !== 1 || !isValidNetwork(parsed)) {
      return { ok: false, error: "corrupt" };
    }

    return {
      ok: true,
      network: {
        nodes: parsed.nodes.map(node => ({ ...node })),
        edges: parsed.edges.map(edge => ({ ...edge })),
      },
    };
  } catch {
    return { ok: false, error: "corrupt" };
  }
}

function isValidNetwork(network) {
  if (!network || !Array.isArray(network.nodes) || !Array.isArray(network.edges)) {
    return false;
  }

  const nodeIds = new Set();
  for (const node of network.nodes) {
    if (
      !node
      || typeof node.id !== "string"
      || node.id.length === 0
      || nodeIds.has(node.id)
      || !Object.hasOwn(DEVICE_TYPES, node.type)
      || typeof node.name !== "string"
      || node.name.trim().length === 0
      || node.name.length > 24
      || !Number.isFinite(node.x)
      || !Number.isFinite(node.y)
      || node.x < 84
      || node.x > VIEWBOX.width - 84
      || node.y < 48
      || node.y > VIEWBOX.height - 48
    ) {
      return false;
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set();
  const endpointPairs = new Set();
  for (const edge of network.edges) {
    if (
      !edge
      || typeof edge.id !== "string"
      || edge.id.length === 0
      || edgeIds.has(edge.id)
      || typeof edge.from !== "string"
      || typeof edge.to !== "string"
      || edge.from === edge.to
      || !nodeIds.has(edge.from)
      || !nodeIds.has(edge.to)
    ) {
      return false;
    }

    const endpointPair = [edge.from, edge.to].sort().join("\u0000");
    if (endpointPairs.has(endpointPair)) {
      return false;
    }
    edgeIds.add(edge.id);
    endpointPairs.add(endpointPair);
  }

  return true;
}

function getBrowserStorage() {
  return globalThis.localStorage;
}
