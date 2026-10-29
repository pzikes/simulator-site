import assert from "node:assert/strict";
import test from "node:test";

import { addDevice, connectDevices, createNetwork, moveDevice } from "../src/network.js";
import { loadNetwork, saveNetwork } from "../src/persistence.js";

const STORAGE_KEY = "sitovy-simulator.network.v1";

function createMemoryStorage(initialValue = null, overrides = {}) {
  const values = new Map();
  if (initialValue !== null) {
    values.set(STORAGE_KEY, initialValue);
  }
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    ...overrides,
  };
}

const providerFor = storage => () => storage;

function createSampleNetwork() {
  const network = createNetwork();
  const computer = addDevice(network, {
    type: "computer",
    name: "Učebna 1",
    x: 120,
    y: 120,
  });
  const server = addDevice(network, {
    type: "server",
    name: "Server",
    x: 500,
    y: 300,
  });
  connectDevices(network, computer.id, server.id);
  return network;
}

test("saveNetwork and loadNetwork preserve device positions and cable endpoints", () => {
  const storage = createMemoryStorage();
  const network = createSampleNetwork();
  moveDevice(network, network.nodes[0].id, 200, 220);

  assert.deepEqual(saveNetwork(network, providerFor(storage)), { ok: true });
  const loaded = loadNetwork(providerFor(storage));

  assert.deepEqual(loaded, { ok: true, network });
  assert.deepEqual([...storage.values.keys()], [STORAGE_KEY]);
});

test("saveNetwork overwrites the previously saved network", () => {
  const storage = createMemoryStorage();
  const provider = providerFor(storage);
  const first = createSampleNetwork();
  const second = createNetwork();

  assert.deepEqual(saveNetwork(first, provider), { ok: true });
  assert.deepEqual(saveNetwork(second, provider), { ok: true });
  assert.deepEqual(loadNetwork(provider), { ok: true, network: second });
});

test("loadNetwork reports missing data without fabricating a network", () => {
  assert.deepEqual(loadNetwork(providerFor(createMemoryStorage())), {
    ok: false,
    error: "not-found",
  });
});

test("loadNetwork rejects corrupt JSON and malformed or unsupported networks", () => {
  const invalidValues = [
    "{broken",
    JSON.stringify({ version: 2, nodes: [], edges: [] }),
    JSON.stringify({ version: 1, nodes: [{ id: "x", type: "computer" }], edges: [] }),
    JSON.stringify({
      version: 1,
      nodes: [{ id: "x", type: "computer", name: "PC", x: 100, y: 100 }],
      edges: [{ id: "cable", from: "x", to: "missing" }],
    }),
    JSON.stringify({
      version: 1,
      nodes: [
        { id: "x", type: "computer", name: "PC 1", x: 100, y: 100 },
        { id: "x", type: "server", name: "Server", x: 300, y: 100 },
      ],
      edges: [],
    }),
    JSON.stringify({
      version: 1,
      nodes: [
        { id: "x", type: "computer", name: "PC 1", x: 100, y: 100 },
        { id: "y", type: "server", name: "Server", x: 300, y: 100 },
      ],
      edges: [
        { id: "cable-1", from: "x", to: "y" },
        { id: "cable-2", from: "y", to: "x" },
      ],
    }),
  ];

  for (const serialized of invalidValues) {
    assert.deepEqual(loadNetwork(providerFor(createMemoryStorage(serialized))), {
      ok: false,
      error: "corrupt",
    });
  }
});

test("saveNetwork rejects malformed network data", () => {
  const storage = createMemoryStorage();

  assert.deepEqual(saveNetwork({ nodes: [], edges: [{ id: "bad" }] }, providerFor(storage)), {
    ok: false,
    error: "invalid-network",
  });
  assert.equal(storage.values.has(STORAGE_KEY), false);
});

test("saveNetwork and loadNetwork report unavailable storage and I/O errors", () => {
  assert.equal(saveNetwork(createNetwork(), () => undefined).error, "unavailable");
  assert.equal(loadNetwork(() => undefined).error, "unavailable");
  assert.equal(
    saveNetwork(createNetwork(), () => {
      throw new Error("storage denied");
    }).error,
    "write-failed",
  );
  assert.equal(
    saveNetwork(createNetwork(), () => ({
      setItem() {
        throw new Error("quota exceeded");
      },
    })).error,
    "write-failed",
  );
  assert.equal(
    loadNetwork(() => {
      throw new Error("storage denied");
    }).error,
    "read-failed",
  );
  assert.equal(
    loadNetwork(() => ({
      getItem() {
        throw new Error("read denied");
      },
    })).error,
    "read-failed",
  );
});
