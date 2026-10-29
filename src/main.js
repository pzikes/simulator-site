import {
  addDevice,
  clampPosition,
  connectDevices,
  createNetwork,
  DEVICE_TYPES,
  findPath,
  moveDevice,
  removeConnection,
  removeDevice,
} from "./network.js";
import {
  animatePacket,
  renderConnections,
  renderDevices,
  setPathHighlight,
  setVisitedDevices,
  updateConnectionPositions,
  updateDeviceElement,
} from "./render.js";

const MOVE_STEP = 20;
const GRID_COLUMNS = [110, 305, 500, 695, 890];
const GRID_ROWS = [70, 185, 300, 415, 530];

const network = createNetwork();
const board = requireElement("#network-board");
const connectionLayer = requireElement("#connection-layer");
const deviceLayer = requireElement("#device-layer");
const packetLayer = requireElement("#packet-layer");
const nameInput = requireElement("#device-name");
const packetSource = requireElement("#packet-source");
const packetTarget = requireElement("#packet-target");
const sendPacketButton = requireElement("#send-packet-button");
const cancelPacketButton = requireElement("#cancel-packet-button");
const packetExplanation = requireElement("#packet-explanation");
const connectionModeButton = requireElement("#connection-mode-button");
const connectionModeHelp = requireElement("#connection-mode-help");
const deleteConnectionButton = requireElement("#delete-connection-button");
const selectionEmpty = requireElement("#selection-empty");
const selectionDetails = requireElement("#selection-details");
const selectedName = requireElement("#selected-name");
const selectedType = requireElement("#selected-type");
const selectedPosition = requireElement("#selected-position");
const deleteButton = requireElement("#delete-button");
const statusMessage = requireElement("#status-message");

let selectedDeviceId = null;
let selectedConnectionId = null;
let connectionMode = false;
let pendingConnectionStartId = null;
let dragState = null;
let cancelPacketTransfer = null;
let packetTransferActive = false;

document.querySelectorAll("[data-add-type]").forEach(button => {
  button.addEventListener("click", () => addDeviceFromPanel(button.dataset.addType));
});

document.querySelectorAll("[data-move]").forEach(button => {
  button.addEventListener("click", () => moveSelectedDevice(button.dataset.move));
});

deleteButton.addEventListener("click", deleteSelectedDevice);
connectionModeButton.addEventListener("click", () => toggleConnectionMode());
deleteConnectionButton.addEventListener("click", deleteSelectedConnection);
sendPacketButton.addEventListener("click", sendPacket);
cancelPacketButton.addEventListener("click", cancelCurrentPacketTransfer);
packetSource.addEventListener("change", updatePacketControls);
packetTarget.addEventListener("change", updatePacketControls);
board.addEventListener("pointerdown", handlePointerDown);
board.addEventListener("pointermove", handlePointerMove);
board.addEventListener("pointerup", finishPointerMove);
board.addEventListener("pointercancel", finishPointerMove);
board.addEventListener("lostpointercapture", finishPointerMove);
board.addEventListener("keydown", handleBoardKeyDown);
board.addEventListener("click", handleBoardClick);

render();

function addDeviceFromPanel(type) {
  if (!Object.hasOwn(DEVICE_TYPES, type)) {
    showError("Vybraný typ zařízení není podporován.");
    return;
  }

  const position = findAvailablePosition();
  if (!position) {
    showError("Na ploše už není volné místo. Přesuň nebo odstraň některé zařízení.");
    return;
  }

  const requestedName = nameInput.value.trim();
  const name = requestedName || nextDefaultName(type);
  try {
    const device = addDevice(network, { type, name, ...position });
    if (network.nodes.length === 2 && packetSource.value === packetTarget.value) {
      packetTarget.value = device.id;
    }
    selectedDeviceId = device.id;
    nameInput.value = "";
    render();
    showStatus(`Zařízení „${device.name}“ (${DEVICE_TYPES[type]}) bylo přidáno.`);
  } catch (error) {
    showError(error.message);
  }
}

function findAvailablePosition() {
  for (const y of GRID_ROWS) {
    for (const x of GRID_COLUMNS) {
      const isOccupied = network.nodes.some(device => (
        Math.abs(device.x - x) < 180 && Math.abs(device.y - y) < 108
      ));
      if (!isOccupied) {
        return clampPosition(x, y);
      }
    }
  }
  return null;
}

function nextDefaultName(type) {
  const index = network.nodes.filter(device => device.type === type).length + 1;
  return `${DEVICE_TYPES[type]} ${index}`;
}

function handlePointerDown(event) {
  if (packetTransferActive || event.button !== 0 || !event.isPrimary) {
    return;
  }

  const deviceElement = getDeviceElement(event.target);
  if (!deviceElement) {
    if (event.target === board.firstElementChild) {
      selectDevice(null);
    }
    return;
  }

  if (connectionMode) {
    return;
  }

  event.preventDefault();
  const device = getDevice(deviceElement.dataset.deviceId);
  if (!device) {
    showError("Vybrané zařízení už v síti neexistuje.");
    return;
  }

  try {
    deviceElement.setPointerCapture(event.pointerId);
  } catch (error) {
    showError(`Zařízení nelze přesunout: ${error.message}`);
    return;
  }

  dragState = {
    pointerId: event.pointerId,
    deviceId: device.id,
    element: deviceElement,
  };
  selectDevice(device.id);
  showStatus(`Vybráno zařízení „${device.name}“.`);
}

function handlePointerMove(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  let position;
  try {
    position = screenToSvg(event.clientX, event.clientY);
  } catch (error) {
    showError(`Souřadnice ukazatele se nepodařilo převést: ${error.message}`);
    return;
  }
  if (!position) {
    showError("Souřadnice ukazatele se nepodařilo převést na plochu SVG.");
    return;
  }

  try {
    const device = moveDevice(network, dragState.deviceId, position.x, position.y);
    updateDeviceElement(dragState.element, device, true);
    updateConnectionPositions(connectionLayer, network);
    updateSelectionDetails(device);
  } catch (error) {
    finishPointerMove(event);
    showError(error.message);
  }
}

function finishPointerMove(event) {
  if (dragState && dragState.pointerId === event.pointerId) {
    dragState = null;
  }
}

function screenToSvg(clientX, clientY) {
  const matrix = board.getScreenCTM();
  if (!matrix) {
    return null;
  }

  const point = board.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  if (!Number.isFinite(transformed.x) || !Number.isFinite(transformed.y)) {
    return null;
  }
  return clampPosition(transformed.x, transformed.y);
}

function handleBoardKeyDown(event) {
  if (packetTransferActive) {
    return;
  }

  const connectionElement = getConnectionElement(event.target);
  if (connectionElement) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectConnection(connectionElement.dataset.connectionId);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      selectConnection(connectionElement.dataset.connectionId);
      deleteSelectedConnection();
      return;
    }
  }

  const deviceElement = getDeviceElement(event.target);
  if (!deviceElement) {
    return;
  }

  if (event.key === "Escape" && connectionMode) {
    event.preventDefault();
    toggleConnectionMode(false);
    return;
  }

  const id = deviceElement.dataset.deviceId;
  const device = getDevice(id);
  if (!device) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (connectionMode) {
      handleConnectionEndpoint(id);
    } else {
      selectDevice(id);
      showStatus(`Vybráno zařízení „${device.name}“.`);
    }
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    selectDevice(id);
    deleteSelectedDevice();
    return;
  }

  const directions = {
    ArrowUp: [0, -MOVE_STEP],
    ArrowDown: [0, MOVE_STEP],
    ArrowLeft: [-MOVE_STEP, 0],
    ArrowRight: [MOVE_STEP, 0],
  };
  const movement = directions[event.key];
  if (movement && !connectionMode) {
    event.preventDefault();
    selectDevice(id);
    moveDeviceBy(movement[0], movement[1], true);
  }
}

function handleBoardClick(event) {
  if (packetTransferActive) {
    return;
  }

  const connectionElement = getConnectionElement(event.target);
  if (connectionElement) {
    if (connectionMode) {
      showStatus("Vypni režim propojení, pokud chceš vybrat nebo odstranit kabel.");
      return;
    }
    selectConnection(connectionElement.dataset.connectionId);
    return;
  }

  const deviceElement = getDeviceElement(event.target);
  if (deviceElement) {
    const id = deviceElement.dataset.deviceId;
    if (connectionMode) {
      handleConnectionEndpoint(id);
    } else {
      selectDevice(id);
      showStatus(`Vybráno zařízení „${getDevice(id)?.name}“.`);
    }
    return;
  }

  if (event.target === board.firstElementChild) {
    selectDevice(null);
    selectConnection(null);
  }
}

function toggleConnectionMode(forceState = !connectionMode) {
  connectionMode = forceState;
  pendingConnectionStartId = null;
  selectedConnectionId = null;
  connectionModeButton.setAttribute("aria-pressed", String(connectionMode));
  connectionModeButton.textContent = connectionMode
    ? "Vypnout režim propojení"
    : "Zapnout režim propojení";
  connectionModeHelp.textContent = connectionMode
    ? "Vyber první a potom druhé zařízení. Režim můžeš zrušit klávesou Escape."
    : "Zapni režim, potom vyber dvě různá zařízení.";
  updateConnectionSelection();
  renderConnections(connectionLayer, network, selectedConnectionId);

  if (connectionMode) {
    showStatus("Režim propojení zapnut. Vyber první zařízení.");
  } else {
    showStatus("Režim propojení vypnut.");
  }
}

function handleConnectionEndpoint(id) {
  const device = getDevice(id);
  if (!device) {
    showError("Vybrané zařízení už v síti neexistuje.");
    return;
  }

  if (!pendingConnectionStartId) {
    pendingConnectionStartId = id;
    selectDevice(id);
    showStatus(`První zařízení: „${device.name}“. Teď vyber druhé zařízení.`);
    return;
  }

  try {
    connectDevices(network, pendingConnectionStartId, id);
    const start = getDevice(pendingConnectionStartId);
    pendingConnectionStartId = null;
    selectedConnectionId = null;
    renderConnections(connectionLayer, network, selectedConnectionId);
    updateConnectionSelection();
    showStatus(`Kabel mezi „${start.name}“ a „${device.name}“ byl vytvořen.`);
  } catch (error) {
    showError(error.message);
  }
}

function moveSelectedDevice(direction) {
  const offsets = {
    up: [0, -MOVE_STEP],
    down: [0, MOVE_STEP],
    left: [-MOVE_STEP, 0],
    right: [MOVE_STEP, 0],
  };
  const offset = offsets[direction];
  if (!offset) {
    showError("Požadovaný směr přesunu není podporován.");
    return;
  }
  moveDeviceBy(offset[0], offset[1], false);
}

function moveDeviceBy(dx, dy, restoreFocus) {
  const device = getDevice(selectedDeviceId);
  if (!device) {
    showError("Nejprve vyber zařízení, které chceš přesunout.");
    return;
  }

  try {
    moveDevice(network, device.id, device.x + dx, device.y + dy);
    render();
    updateSelectionPanel();
    if (restoreFocus) {
      deviceLayer.querySelector(`[data-device-id="${device.id}"]`)?.focus();
    }
  } catch (error) {
    showError(error.message);
  }
}

function deleteSelectedDevice() {
  if (!selectedDeviceId) {
    showError("Nejprve vyber zařízení, které chceš odstranit.");
    return;
  }

  try {
    const removedDeviceId = selectedDeviceId;
    const removedName = getDevice(removedDeviceId)?.name;
    removeDevice(network, removedDeviceId);
    selectedDeviceId = null;
    selectedConnectionId = null;
    if (pendingConnectionStartId === removedDeviceId) {
      pendingConnectionStartId = null;
    }
    dragState = null;
    render();
    showStatus(`Zařízení „${removedName}“ bylo odstraněno.`);
  } catch (error) {
    showError(error.message);
  }
}

function deleteSelectedConnection() {
  if (!selectedConnectionId) {
    showError("Nejprve vyber kabel, který chceš odstranit.");
    return;
  }

  try {
    const connection = network.edges.find(edge => edge.id === selectedConnectionId);
    if (!connection) {
      throw new RangeError(`Spojení s ID ${selectedConnectionId} neexistuje.`);
    }
    const from = getDevice(connection.from);
    const to = getDevice(connection.to);
    removeConnection(network, selectedConnectionId);
    selectedConnectionId = null;
    renderConnections(connectionLayer, network, selectedConnectionId);
    updateConnectionSelection();
    showStatus(`Kabel mezi „${from.name}“ a „${to.name}“ byl odstraněn.`);
  } catch (error) {
    showError(error.message);
  }
}

function selectDevice(id) {
  selectedDeviceId = id;
  selectedConnectionId = null;
  deviceLayer.querySelectorAll("[data-device-id]").forEach(element => {
    const selected = element.dataset.deviceId === id;
    element.classList.toggle("is-selected", selected);
    element.setAttribute("aria-pressed", String(selected));
  });
  updateConnectionSelection();
  updateSelectionPanel();
}

function selectConnection(id) {
  selectedConnectionId = id;
  updateConnectionSelection();
  const connection = network.edges.find(edge => edge.id === id);
  if (connection) {
    showStatus("Kabel vybrán. Můžeš ho odstranit tlačítkem v panelu.");
  }
}

function updateConnectionSelection() {
  connectionLayer.querySelectorAll("[data-connection-id]").forEach(element => {
    const selected = element.dataset.connectionId === selectedConnectionId;
    element.classList.toggle("is-selected", selected);
    element.setAttribute("aria-pressed", String(selected));
  });
  deleteConnectionButton.disabled = packetTransferActive || !selectedConnectionId || connectionMode;
}

function updateSelectionPanel() {
  const device = getDevice(selectedDeviceId);
  const isSelected = Boolean(device);
  selectionEmpty.hidden = isSelected;
  selectionDetails.hidden = !isSelected;
  deleteButton.disabled = packetTransferActive || !isSelected;
  document.querySelectorAll("[data-move]").forEach(button => {
    button.disabled = packetTransferActive || !isSelected;
  });

  if (device) {
    updateSelectionDetails(device);
  }
}

function updateSelectionDetails(device) {
  selectedName.textContent = device.name;
  selectedType.textContent = DEVICE_TYPES[device.type];
  selectedPosition.textContent = `${Math.round(device.x)}, ${Math.round(device.y)}`;
}

function render() {
  renderConnections(connectionLayer, network, selectedConnectionId);
  renderDevices(deviceLayer, network, selectedDeviceId);
  updatePacketEndpoints();
  updateConnectionSelection();
  updateSelectionPanel();
  updatePacketControls();
}

function getDevice(id) {
  return network.nodes.find(device => device.id === id);
}

function getDeviceElement(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest("[data-device-id]");
}

function getConnectionElement(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest("[data-connection-id]");
}

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("is-error");
}

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add("is-error");
}

function updatePacketEndpoints() {
  const previousSource = packetSource.value;
  const previousTarget = packetTarget.value;
  const options = network.nodes.map(device => {
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = `${device.name} — ${DEVICE_TYPES[device.type]}`;
    return option;
  });
  packetSource.replaceChildren(...options.map(option => option.cloneNode(true)));
  packetTarget.replaceChildren(...options);

  const nodeIds = new Set(network.nodes.map(device => device.id));
  packetSource.value = nodeIds.has(previousSource)
    ? previousSource
    : network.nodes[0]?.id ?? "";
  packetTarget.value = nodeIds.has(previousTarget)
    ? previousTarget
    : network.nodes[1]?.id ?? network.nodes[0]?.id ?? "";
}

function updatePacketControls() {
  document.querySelectorAll("[data-add-type]").forEach(button => {
    button.disabled = packetTransferActive;
  });
  document.querySelectorAll("[data-move]").forEach(button => {
    button.disabled = packetTransferActive || !getDevice(selectedDeviceId);
  });
  deleteButton.disabled = packetTransferActive || !getDevice(selectedDeviceId);
  connectionModeButton.disabled = packetTransferActive;
  deleteConnectionButton.disabled =
    packetTransferActive || !selectedConnectionId || connectionMode;
  packetSource.disabled = packetTransferActive;
  packetTarget.disabled = packetTransferActive;
  sendPacketButton.disabled =
    packetTransferActive || !packetSource.value || !packetTarget.value;
  cancelPacketButton.hidden = !packetTransferActive;
  cancelPacketButton.disabled = !packetTransferActive;
}

function sendPacket() {
  if (packetTransferActive) {
    return;
  }

  const source = getDevice(packetSource.value);
  const target = getDevice(packetTarget.value);
  if (!source || !target) {
    showError("Vyber platného odesílatele i příjemce.");
    return;
  }

  if (source.id === target.id) {
    packetExplanation.textContent =
      `Odesílatel a příjemce jsou stejné zařízení „${source.name}“. Paket nikam necestuje.`;
    showStatus("Odesílatel a příjemce jsou stejní; přenos není potřeba.");
    return;
  }

  const path = findPath(network.nodes, network.edges, source.id, target.id);
  if (!path) {
    packetExplanation.textContent =
      `Mezi „${source.name}“ a „${target.name}“ není v aktuálním grafu cesta. Zkontroluj kabelová spojení.`;
    showError("Paket nelze doručit: mezi vybranými zařízeními není cesta.");
    return;
  }

  const visitedDevices = [];
  const visitedIds = [];
  packetTransferActive = true;
  setPathHighlight(connectionLayer, network.edges, path, true);
  setVisitedDevices(deviceLayer, []);
  updatePacketControls();
  packetExplanation.textContent = "Paket začíná cestu po nejkratší nalezené trase.";
  showStatus(`Odesílám paket ze zařízení „${source.name}“.`);

  try {
    cancelPacketTransfer = animatePacket(packetLayer, network.nodes, network.edges, path, {
      onVisit(device, pathIndex) {
        visitedDevices.push(`${device.name} (${DEVICE_TYPES[device.type]})`);
        visitedIds.push(device.id);
        setVisitedDevices(deviceLayer, visitedIds);
        packetExplanation.textContent =
          `Navštívená zařízení (${pathIndex + 1}/${path.length}): ${visitedDevices.join(" → ")}.`;
        showStatus(`Paket dorazil k zařízení „${device.name}“.`);
      },
      onComplete({ cancelled }) {
        cancelPacketTransfer = null;
        packetTransferActive = false;
        setPathHighlight(connectionLayer, network.edges, path, false);
        setVisitedDevices(deviceLayer, []);
        updatePacketControls();
        if (cancelled) {
          packetExplanation.textContent = "Přenos byl přerušen.";
          showStatus("Přenos paketu byl přerušen.");
        } else {
          packetExplanation.textContent =
            `Paket dorazil k příjemci „${target.name}“. Navštívená zařízení: ${visitedDevices.join(" → ")}.`;
          showStatus(`Paket byl doručen zařízení „${target.name}“.`);
        }
      },
    });
  } catch (error) {
    packetTransferActive = false;
    setPathHighlight(connectionLayer, network.edges, path, false);
    setVisitedDevices(deviceLayer, []);
    updatePacketControls();
    showError(error.message);
  }
}

function cancelCurrentPacketTransfer() {
  cancelPacketTransfer?.();
}

function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Chybí očekávaný prvek rozhraní: ${selector}.`);
  }
  return element;
}
