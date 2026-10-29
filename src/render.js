import { DEVICE_TYPES } from "./network.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const CARD_WIDTH = 168;
const CARD_HEIGHT = 96;

const TYPE_CODES = Object.freeze({
  computer: "PC",
  switch: "SW",
  router: "RT",
  server: "SRV",
});

export function renderDevices(layer, network, selectedDeviceId) {
  const elements = [];

  if (network.nodes.length === 0) {
    const emptyState = createSvgElement("text", {
      class: "empty-state",
      x: "500",
      y: "305",
    });
    emptyState.textContent = "Přidej zařízení pomocí panelu.";
    elements.push(emptyState);
  }

  for (const device of network.nodes) {
    elements.push(createDeviceElement(device, device.id === selectedDeviceId));
  }

  layer.replaceChildren(...elements);
}

export function renderConnections(layer, network, selectedConnectionId) {
  const devicesById = new Map(network.nodes.map(device => [device.id, device]));
  const elements = network.edges.map(connection => {
    const from = devicesById.get(connection.from);
    const to = devicesById.get(connection.to);
    if (!from || !to) {
      throw new Error(`Spojení ${connection.id} odkazuje na neexistující zařízení.`);
    }

    return createConnectionElement(connection, from, to, connection.id === selectedConnectionId);
  });
  layer.replaceChildren(...elements);
}

export function updateConnectionPositions(layer, network) {
  const devicesById = new Map(network.nodes.map(device => [device.id, device]));
  layer.querySelectorAll("[data-connection-id]").forEach(element => {
    const connection = network.edges.find(edge => edge.id === element.dataset.connectionId);
    const from = connection && devicesById.get(connection.from);
    const to = connection && devicesById.get(connection.to);
    if (!connection || !from || !to) {
      throw new Error(`Nelze aktualizovat neplatné spojení ${element.dataset.connectionId}.`);
    }

    setConnectionEndpoints(element, from, to);
  });
}

export function setPathHighlight(layer, edges, path, highlighted) {
  const pathPairs = new Set();
  for (let index = 1; index < path.length; index += 1) {
    pathPairs.add(connectionKey(path[index - 1], path[index]));
  }

  for (const edge of edges) {
    const element = layer.querySelector(`[data-connection-id="${edge.id}"]`);
    if (element && pathPairs.has(connectionKey(edge.from, edge.to))) {
      element.classList.toggle("is-on-path", highlighted);
    }
  }
}

export function setVisitedDevices(layer, visitedIds) {
  const visited = new Set(visitedIds);
  layer.querySelectorAll("[data-device-id]").forEach(element => {
    element.classList.toggle("is-packet-visited", visited.has(element.dataset.deviceId));
  });
}

export function animatePacket(layer, nodes, edges, path, {
  onVisit = () => {},
  onComplete = () => {},
  durationPerEdge = 550,
} = {}) {
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(path) || path.length < 2) {
    throw new TypeError("Animace vyžaduje uzly, spojení a cestu s alespoň dvěma zařízeními.");
  }
  if (!Number.isFinite(durationPerEdge) || durationPerEdge <= 0) {
    throw new RangeError("Délka animace každého kabelu musí být kladná.");
  }

  const devicesById = new Map(nodes.map(device => [device.id, device]));
  const pathDevices = path.map(id => devicesById.get(id));
  if (pathDevices.some(device => !device)) {
    throw new RangeError("Cesta obsahuje zařízení, které v síti neexistuje.");
  }

  for (let index = 1; index < path.length; index += 1) {
    const connected = edges.some(edge => (
      (edge.from === path[index - 1] && edge.to === path[index])
      || (edge.to === path[index - 1] && edge.from === path[index])
    ));
    if (!connected) {
      throw new RangeError("Cesta obsahuje dvojici zařízení bez kabelového spojení.");
    }
  }

  const packet = createSvgElement("circle", {
    class: "packet-marker",
    r: "10",
    "aria-hidden": "true",
  });
  layer.replaceChildren(packet);

  let segmentIndex = 0;
  let segmentStart = null;
  let animationFrame = null;
  let finished = false;
  onVisit(pathDevices[0], 0);

  const finish = cancelled => {
    if (finished) {
      return;
    }
    finished = true;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
    }
    packet.remove();
    onComplete({ cancelled });
  };

  const animateFrame = timestamp => {
    if (finished) {
      return;
    }
    if (segmentStart === null) {
      segmentStart = timestamp;
    }

    const progress = Math.min(1, (timestamp - segmentStart) / durationPerEdge);
    const from = pathDevices[segmentIndex];
    const to = pathDevices[segmentIndex + 1];
    packet.setAttribute("cx", String(from.x + (to.x - from.x) * progress));
    packet.setAttribute("cy", String(from.y + (to.y - from.y) * progress));

    if (progress === 1) {
      segmentIndex += 1;
      onVisit(pathDevices[segmentIndex], segmentIndex);
      if (segmentIndex === pathDevices.length - 1) {
        finish(false);
        return;
      }
      segmentStart = null;
    }

    animationFrame = requestAnimationFrame(animateFrame);
  };

  animationFrame = requestAnimationFrame(animateFrame);
  return () => finish(true);
}

export function updateDeviceElement(element, device, selected = false) {
  element.setAttribute("transform", `translate(${device.x} ${device.y})`);
  element.setAttribute(
    "aria-label",
    `${device.name}, ${DEVICE_TYPES[device.type]}, pozice ${Math.round(device.x)}, ${Math.round(device.y)}`,
  );
  element.setAttribute("aria-pressed", String(selected));

  const coordinateLabel = element.querySelector(".device-coordinate");
  coordinateLabel.textContent = `x: ${Math.round(device.x)} · y: ${Math.round(device.y)}`;

  const title = element.querySelector("title");
  title.textContent = `${device.name} — ${DEVICE_TYPES[device.type]}`;
}

function createConnectionElement(connection, from, to, selected) {
  const element = createSvgElement("g", {
    class: `connection${selected ? " is-selected" : ""}`,
    "data-connection-id": connection.id,
    role: "button",
    tabindex: "0",
    "aria-pressed": String(selected),
    "aria-label": `Kabel mezi ${from.name} a ${to.name}`,
  });
  const visibleLine = createSvgElement("line", {
    class: "connection-line",
  });
  const hitArea = createSvgElement("line", {
    class: "connection-hit-area",
    "aria-hidden": "true",
  });
  element.append(visibleLine, hitArea);
  setConnectionEndpoints(element, from, to);
  return element;
}

function setConnectionEndpoints(element, from, to) {
  for (const line of element.children) {
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
  }
}

function connectionKey(firstId, secondId) {
  return [firstId, secondId].sort().join("\u0000");
}

function createDeviceElement(device, selected) {
  const element = createSvgElement("g", {
    class: `device device--${device.type}${selected ? " is-selected" : ""}`,
    "data-device-id": device.id,
    role: "button",
    tabindex: "0",
  });

  const card = createSvgElement("rect", {
    class: "device-card",
    x: String(-CARD_WIDTH / 2),
    y: String(-CARD_HEIGHT / 2),
    width: String(CARD_WIDTH),
    height: String(CARD_HEIGHT),
    rx: "12",
  });
  const header = createSvgElement("rect", {
    class: "device-card-header",
    x: String(-CARD_WIDTH / 2),
    y: String(-CARD_HEIGHT / 2),
    width: String(CARD_WIDTH),
    height: "31",
    rx: "11",
  });
  const headerCover = createSvgElement("rect", {
    class: "device-card-header",
    x: String(-CARD_WIDTH / 2),
    y: "-18",
    width: String(CARD_WIDTH),
    height: "8",
  });
  const typeLabel = createSvgElement("text", {
    class: "device-type",
    x: "0",
    y: "-29",
    "text-anchor": "middle",
  });
  typeLabel.textContent = TYPE_CODES[device.type];

  const nameLabel = createSvgElement("text", {
    class: "device-name",
    x: "0",
    y: "7",
    "text-anchor": "middle",
  });
  if (device.name.length > 18) {
    nameLabel.setAttribute("textLength", "150");
    nameLabel.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }
  nameLabel.textContent = device.name;

  const coordinateLabel = createSvgElement("text", {
    class: "device-coordinate",
    x: "0",
    y: "28",
    "text-anchor": "middle",
  });
  const title = createSvgElement("title");

  element.append(card, header, headerCover, typeLabel, nameLabel, coordinateLabel, title);
  updateDeviceElement(element, device, selected);
  return element;
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  return element;
}
