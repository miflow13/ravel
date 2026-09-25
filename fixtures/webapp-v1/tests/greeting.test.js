import test from "node:test";
import assert from "node:assert/strict";
import { greeting } from "../src/app.js";

test("greets with the frozen expected punctuation", () => {
  assert.equal(greeting("Ravel"), "Hello, Ravel!");
});
