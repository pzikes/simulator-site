import assert from "node:assert/strict";
import test from "node:test";

import {
  addDevice,
  createNetwork,
  DEVICE_TYPES,
  moveDevice,
  removeDevice,
} from "../src/network.js";

test("addDevice creates typed, named nodes with unique IDs", () => {
  const network = createNetwork();
  const nodes = Object.keys(DEVICE_TYPES).map(type => addDevice(network, {
    type,
    name: `  ${DEVICE_TYPES[type]}  `,
    x: 200,
    y: 120,
  }));

  assert.equal(network.nodes.length, 4);
  assert.deepEqual(nodes.map(node => node.type), Object.keys(DEVICE_TYPES));
  assert.deepEqual(nodes.map(node => node.name), Object.values(DEVICE_TYPES));
  assert.equal(new Set(nodes.map(node => node.id)).size, nodes.length);
  assert.ok(nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.deepEqual(network.edges, []);
});

test("addDevice keeps positions inside the visible board", () => {
  const network = createNetwork();
  const node = addDevice(network, {
    type: "computer",
    name: "PC",
    x: -100,
    y: 1000,
  });

  assert.deepEqual({ x: node.x, y: node.y }, { x: 84, y: 552 });
});

test("addDevice rejects invalid types, names, and non-finite coordinates", () => {
  const network = createNetwork();

  assert.throws(
    () => addDevice(network, { type: "unknown", name: "PC", x: 100, y: 100 }),
    RangeError,
  );
  assert.throws(
    () => addDevice(network, { type: "computer", name: "  ", x: 100, y: 100 }),
    RangeError,
  );
  assert.throws(
    () => addDevice(network, { type: "computer", name: "x".repeat(25), x: 100, y: 100 }),
    RangeError,
  );
  assert.throws(
    () => addDevice(network, { type: "computer", name: "PC", x: Number.NaN, y: 100 }),
    TypeError,
  );
});

test("moveDevice updates only the selected node and clamps its position", () => {
  const network = createNetwork();
  const first = addDevice(network, {
    type: "computer",
    name: "PC",
    x: 100,
    y: 100,
  });
  const second = addDevice(network, {
    type: "server",
    name: "Server",
    x: 300,
    y: 200,
  });

  const moved = moveDevice(network, first.id, 5000, -20);

  assert.equal(moved.id, first.id);
  assert.deepEqual({ x: moved.x, y: moved.y }, { x: 916, y: 48 });
  assert.deepEqual({ x: second.x, y: second.y }, { x: 300, y: 200 });
  assert.deepEqual(network.edges, []);
});

test("moveDevice rejects an unknown node and invalid coordinates", () => {
  const network = createNetwork();

  assert.throws(() => moveDevice(network, "missing", 100, 100), RangeError);
  const node = addDevice(network, {
    type: "router",
    name: "Router",
    x: 100,
    y: 100,
  });
  assert.throws(() => moveDevice(network, node.id, Infinity, 100), TypeError);
});

test("removeDevice deletes its connected edges and rejects an unknown node", () => {
  const network = createNetwork();
  const first = addDevice(network, {
    type: "computer",
    name: "PC",
    x: 100,
    y: 100,
  });
  const second = addDevice(network, {
    type: "switch",
    name: "Switch",
    x: 300,
    y: 100,
  });
  const third = addDevice(network, {
    type: "server",
    name: "Server",
    x: 500,
    y: 100,
  });
  network.edges.push(
    { id: "edge-1", from: first.id, to: second.id },
    { id: "edge-2", from: second.id, to: third.id },
  );

  assert.equal(removeDevice(network, second.id), second);
  assert.deepEqual(network.nodes.map(node => node.id), [first.id, third.id]);
  assert.deepEqual(network.edges, []);
  assert.throws(() => removeDevice(network, second.id), RangeError);
});
