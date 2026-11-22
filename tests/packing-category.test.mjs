import assert from "node:assert/strict";
import test from "node:test";
import { categoryIcon, categoryOrder, normalizeCategory, tripCategories } from "../src/features/trips/model/packing.ts";

test("custom categories join the presets, with Khác always last", () => {
  const list = tripCategories([{ category: "Đồ đi biển" }, { category: null }, { category: "Quần áo" }, { category: "Camping" }]);
  assert.deepEqual(list, ["Quần áo", "Vệ sinh", "Giấy tờ", "Điện tử", "Y tế", "Ăn uống", "Camping", "Đồ đi biển", "Khác"]);
  assert.ok(categoryOrder("Khác", "Đồ đi biển") > 0);
});

test("a typed category reuses an existing spelling and is validated", () => {
  const known = ["Quần áo", "Đồ đi biển"];
  assert.equal(normalizeCategory("  quần   áo ", known), "Quần áo");
  assert.equal(normalizeCategory("ĐỒ ĐI BIỂN", known), "Đồ đi biển");
  assert.equal(normalizeCategory("Leo núi", known), "Leo núi");
  assert.throws(() => normalizeCategory("   ", known), /Nhập tên danh mục/);
  assert.throws(() => normalizeCategory("x".repeat(41), known), /tối đa 40/);
});

test("presets get their own icon and custom ones share a tag", () => {
  assert.equal(categoryIcon("Quần áo"), "👕");
  assert.equal(categoryIcon("Leo núi"), "🏷️");
});
