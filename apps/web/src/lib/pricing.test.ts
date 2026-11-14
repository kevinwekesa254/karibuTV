import { test } from "node:test";
import assert from "node:assert/strict";
import { price } from "./pricing.ts";

test("one price per TV per month", () => {
  assert.equal(price(1).total, 499);
  assert.equal(price(3).total, 1497);
  assert.equal(price(10).total, 4990);
});
test("yearly: 2 months free", () => {
  assert.equal(price(1, 12).total, 4990);
  assert.equal(price(2, 12).total, 9980);
  assert.equal(price(2, 12).saved, 1996);
  assert.equal(price(1, 12).freeMonths, 2);
});
test("other lengths have no discount", () => {
  assert.equal(price(1, 3).total, 1497);
  assert.equal(price(1, 6).total, 2994);
});
test("USD in cents", () => {
  assert.equal(price(3, 1, "USD").total, 11.7);
  assert.equal(price(1, 12, "USD").total, 39);
});
test("bad input is clamped", () => {
  assert.equal(price(0, 0).total, 499);
  assert.equal(price(NaN, NaN).total, 499);
  assert.equal(price(9999).tvs, 500);
});
