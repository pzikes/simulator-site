import assert from "node:assert/strict";
import test from "node:test";

import { findPath } from "../src/network.js";

const nodes = ["A", "B", "C", "D", "E"].map(id => ({ id }));

test("findPath finds the shortest path using an undirected graph", () => {
  const edges = [
    { from: "A", to: "B" },
    { from: "B", to: "C" },
    { from: "A", to: "D" },
    { from: "D", to: "C" },
    { from: "A", to: "C" },
  ];

  assert.deepEqual(findPath(nodes, edges, "C", "A"), ["C", "A"]);
});

test("findPath returns null when no route exists or an endpoint is missing", () => {
  const edges = [{ from: "A", to: "B" }, { from: "C", to: "D" }];

  assert.equal(findPath(nodes, edges, "A", "E"), null);
  assert.equal(findPath(nodes, edges, "missing", "A"), null);
  assert.equal(findPath(nodes, edges, "A", "missing"), null);
});

test("findPath handles cycles without revisiting nodes indefinitely", () => {
  const edges = [
    { from: "A", to: "B" },
    { from: "B", to: "C" },
    { from: "C", to: "A" },
    { from: "C", to: "D" },
    { from: "D", to: "E" },
  ];

  assert.deepEqual(findPath(nodes, edges, "A", "E"), ["A", "C", "D", "E"]);
});

test("findPath returns the source when source and target are the same", () => {
  assert.deepEqual(findPath(nodes, [], "B", "B"), ["B"]);
  assert.equal(findPath(nodes, [], "missing", "missing"), null);
});

test("findPath does not mutate the input arrays or their entries", () => {
  const graphNodes = structuredClone(nodes);
  const edges = [{ from: "A", to: "B" }, { from: "B", to: "C" }];
  const graphEdges = structuredClone(edges);

  findPath(graphNodes, edges, "A", "C");

  assert.deepEqual(graphNodes, nodes);
  assert.deepEqual(edges, graphEdges);
});

test("findPath rejects non-array inputs", () => {
  assert.throws(() => findPath(null, [], "A", "B"), TypeError);
  assert.throws(() => findPath([], null, "A", "B"), TypeError);
});
