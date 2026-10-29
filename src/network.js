export const VIEWBOX = Object.freeze({
  width: 1000,
  height: 600,
});

export const DEVICE_BOUNDS = Object.freeze({
  halfWidth: 84,
  halfHeight: 48,
});

export const DEVICE_TYPES = Object.freeze({
  computer: "Počítač",
  switch: "Switch",
  router: "Router",
  server: "Server",
});

const MAX_NAME_LENGTH = 24;
let nextDeviceId = 0;
let nextConnectionId = 0;

export function createNetwork() {
  return {
    nodes: [],
    edges: [],
  };
}

export function clampPosition(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError("Souřadnice zařízení musí být konečná čísla.");
  }

  return {
    x: Math.min(
      VIEWBOX.width - DEVICE_BOUNDS.halfWidth,
      Math.max(DEVICE_BOUNDS.halfWidth, x),
    ),
    y: Math.min(
      VIEWBOX.height - DEVICE_BOUNDS.halfHeight,
      Math.max(DEVICE_BOUNDS.halfHeight, y),
    ),
  };
}

export function addDevice(network, { type, name, x, y }) {
  assertNetwork(network);

  if (!Object.hasOwn(DEVICE_TYPES, type)) {
    throw new RangeError(`Neznámý typ zařízení: ${type}.`);
  }

  if (typeof name !== "string") {
    throw new TypeError("Název zařízení musí být text.");
  }
  const normalizedName = name.trim();
  if (normalizedName.length === 0 || normalizedName.length > MAX_NAME_LENGTH) {
    throw new RangeError(`Název musí mít 1 až ${MAX_NAME_LENGTH} znaků.`);
  }

  const position = clampPosition(x, y);
  const id = createUniqueId(network);
  const node = {
    id,
    type,
    name: normalizedName,
    ...position,
  };
  network.nodes.push(node);
  return node;
}

export function moveDevice(network, id, x, y) {
  assertNetwork(network);
  const node = network.nodes.find(device => device.id === id);
  if (!node) {
    throw new RangeError(`Zařízení s ID ${id} neexistuje.`);
  }

  Object.assign(node, clampPosition(x, y));
  return node;
}

export function removeDevice(network, id) {
  assertNetwork(network);
  const index = network.nodes.findIndex(device => device.id === id);
  if (index === -1) {
    throw new RangeError(`Zařízení s ID ${id} neexistuje.`);
  }

  const [removed] = network.nodes.splice(index, 1);
  network.edges = network.edges.filter(edge => edge.from !== id && edge.to !== id);
  return removed;
}

export function connectDevices(network, firstDeviceId, secondDeviceId) {
  assertNetwork(network);

  if (firstDeviceId === secondDeviceId) {
    throw new RangeError("Zařízení nelze propojit samo se sebou.");
  }

  const firstExists = network.nodes.some(device => device.id === firstDeviceId);
  const secondExists = network.nodes.some(device => device.id === secondDeviceId);
  if (!firstExists || !secondExists) {
    throw new RangeError("Obě zařízení musí v síti existovat.");
  }

  const duplicate = network.edges.some(edge => (
    (edge.from === firstDeviceId && edge.to === secondDeviceId)
    || (edge.from === secondDeviceId && edge.to === firstDeviceId)
  ));
  if (duplicate) {
    throw new RangeError("Tato zařízení už jsou propojena.");
  }

  nextConnectionId += 1;
  const connection = {
    id: `connection-${nextConnectionId}`,
    from: firstDeviceId,
    to: secondDeviceId,
  };
  network.edges.push(connection);
  return connection;
}

export function removeConnection(network, id) {
  assertNetwork(network);
  const index = network.edges.findIndex(connection => connection.id === id);
  if (index === -1) {
    throw new RangeError(`Spojení s ID ${id} neexistuje.`);
  }

  const [removed] = network.edges.splice(index, 1);
  return removed;
}

export function findPath(nodes, edges, sourceId, targetId) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new TypeError("Uzly a spojení musí být pole.");
  }

  const nodeIds = new Set(nodes.map(node => node?.id));
  if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
    return null;
  }
  if (sourceId === targetId) {
    return [sourceId];
  }

  const adjacency = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (!adjacency.has(edge?.from) || !adjacency.has(edge?.to)) {
      continue;
    }
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  }

  const queue = [sourceId];
  const previous = new Map([[sourceId, null]]);
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const currentId = queue[queueIndex];
    queueIndex += 1;

    for (const neighborId of adjacency.get(currentId)) {
      if (previous.has(neighborId)) {
        continue;
      }

      previous.set(neighborId, currentId);
      if (neighborId === targetId) {
        return buildPath(previous, targetId);
      }
      queue.push(neighborId);
    }
  }

  return null;
}

function buildPath(previous, targetId) {
  const path = [];
  let currentId = targetId;
  while (currentId !== null) {
    path.push(currentId);
    currentId = previous.get(currentId);
  }
  return path.reverse();
}

function assertNetwork(network) {
  if (
    !network
    || !Array.isArray(network.nodes)
    || !Array.isArray(network.edges)
  ) {
    throw new TypeError("Model sítě musí obsahovat pole nodes a edges.");
  }
}

function createUniqueId(network) {
  let id;
  do {
    nextDeviceId += 1;
    id = `device-${nextDeviceId}`;
  } while (network.nodes.some(node => node.id === id));
  return id;
}
