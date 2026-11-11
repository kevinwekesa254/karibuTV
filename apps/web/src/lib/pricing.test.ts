import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, periodTotal } from "./pricing.ts";

test("intro price for months 1-3, standard from month 4", () => {
  assert.equal(quote(1, 1).total, 399);
  assert.equal(quote(1, 3).total, 399);
  assert.equal(quote(1, 4).total, 499);
  assert.equal(quote(1, 4).intro, false);
});

test("4 TVs: no bulk discount", () => {
  const q = quote(4, 1);
  assert.deepEqual([q.subtotal, q.discount, q.total], [1596, 0, 1596]);
});

test("5+ TVs: 15% off the whole bill", () => {
  const a = quote(5, 1), b = quote(5, 4);
  assert.deepEqual([a.subtotal, a.discount, a.total], [1995, 299, 1696]);
  assert.deepEqual([b.subtotal, b.discount, b.total], [2495, 374, 2121]);
  assert.equal(quote(10, 6).total, 4241); // 4990 - 749
});

test("USD rounds to cents", () => {
  assert.equal(quote(5, 1, "USD").total, 13.17); // 15.50 - 2.33 (2.325 rounds half up), same as SQL
  assert.equal(quote(1, 4, "USD").total, 3.9);
});

test("bad input is clamped, never free or negative", () => {
  assert.equal(quote(0, 0).total, 399);
  assert.equal(quote(-3, -1).tvs, 1);
  assert.equal(quote(NaN, NaN).total, 399);
});

test("first year for 2 TVs = 3 intro months + 9 standard months", () => {
  assert.equal(periodTotal(2, 12), 3 * 798 + 9 * 998);
});
