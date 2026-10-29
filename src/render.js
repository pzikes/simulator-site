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
