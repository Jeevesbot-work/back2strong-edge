import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCardioBlocks } from "./cardio";

// Shape stored for a walk-only programme (The Plan dry-run). No assaultBike key.
const walkOnly = {
  inclineWalk: {
    days: "Tue, Thu",
    label: "Easy walk",
    setup: "Outside or treadmill, comfortable pace.",
    byWeek: [
      { week: 1, duration: "30 min" },
      { week: 2, duration: "30 min" },
    ],
  },
};

describe("resolveCardioBlocks", () => {
  it("renders a walk-only programme and does not require assaultBike", () => {
    const blocks = resolveCardioBlocks(walkOnly);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].key, "inclineWalk");
    assert.equal(blocks[0].kind, "walk");
    assert.equal(blocks[0].label, "Easy walk");
    assert.equal(blocks[0].days, "Tue, Thu");
    assert.deepEqual(blocks[0].byWeek, [
      { week: 1, duration: "30 min", format: undefined },
      { week: 2, duration: "30 min", format: undefined },
    ]);
  });

  it("keeps the walk then bike order when both original keys are present", () => {
    const blocks = resolveCardioBlocks({
      assaultBike: { label: "Assault Bike", days: "Fri", rule: "Never before a lower day.", byWeek: [{ week: 1, format: "6 rounds" }] },
      inclineWalk: { label: "Incline Walk", days: "Wed", setup: "10% incline", byWeek: [{ week: 1, duration: "20 min" }] },
    });
    assert.deepEqual(blocks.map((block) => block.key), ["inclineWalk", "assaultBike"]);
    assert.equal(blocks[1].kind, "bike");
    assert.equal(blocks[1].rule, "Never before a lower day.");
  });

  it("shows an unknown cardio key instead of throwing", () => {
    const blocks = resolveCardioBlocks({
      rowing: { label: "Easy row", days: "Sat", byWeek: [{ week: "3", format: "20 min" }] },
    });
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].key, "rowing");
    assert.equal(blocks[0].kind, "other");
    assert.equal(blocks[0].label, "Easy row");
    assert.equal(blocks[0].byWeek[0].week, 3);
    assert.equal(blocks[0].byWeek[0].format, "20 min");
  });

  it("stubs a label from the key when the block has content but no label", () => {
    const blocks = resolveCardioBlocks({
      zone2Bike: { days: "Sun", byWeek: [] },
    });
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "bike");
    assert.equal(blocks[0].label, "Zone2 Bike");
  });

  it("skips missing, null, and malformed blocks without throwing", () => {
    const samples: unknown[] = [
      undefined,
      null,
      1,
      "assaultBike",
      [],
      {},
      { assaultBike: null },
      { assaultBike: "yes" },
      { inclineWalk: { byWeek: null } },
      { inclineWalk: { label: "   ", byWeek: [{ week: "nope" }, "bad", null] } },
      { mystery: { label: "", setup: "" } },
    ];
    for (const sample of samples) {
      assert.doesNotThrow(() => resolveCardioBlocks(sample));
      assert.deepEqual(resolveCardioBlocks(sample), []);
    }
  });

  it("reads an array of blocks and skips the ones that are not objects", () => {
    const blocks = resolveCardioBlocks([
      null,
      { type: "inclineWalk", label: "Walk", days: "Tue", byWeek: [{ week: 1, duration: "20 min" }] },
      { label: "Row", days: "Sat", byWeek: [] },
    ]);
    assert.deepEqual(blocks.map((block) => [block.key, block.kind, block.label]), [
      ["inclineWalk", "walk", "Walk"],
      ["cardio-3", "other", "Row"],
    ]);
  });
});
