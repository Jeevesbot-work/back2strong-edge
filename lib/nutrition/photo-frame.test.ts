import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import sharp from "sharp";
import { inspectMealPhoto } from "./inspect-photo";
import {
  BLANK_PHOTO_MESSAGE,
  NO_FOOD_MESSAGE,
  frameLooksBlank,
  isBlankFrame,
  isUnreadablePhoto,
  mealFromAnalysis,
  parseModelJson,
} from "./photo-frame";

function meal(overrides: Record<string, unknown> = {}) {
  return {
    meal_name: "Chicken and rice",
    calories: 640,
    protein_g: 48,
    carbs_g: 55,
    fat_g: 18,
    edge_comment: "Solid plate. Protein is doing the work.",
    ...overrides,
  };
}

async function jpeg(buffer: Buffer): Promise<string> {
  return buffer.toString("base64");
}

async function solidJpeg(r: number, g: number, b: number): Promise<string> {
  const encoded = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r, g, b } },
  }).jpeg({ quality: 82 }).toBuffer();
  return jpeg(encoded);
}

describe("blank frames", () => {
  it("treats flat black and flat white as empty, and keeps dark detail", () => {
    assert.equal(isBlankFrame(0, 0), true);
    assert.equal(isBlankFrame(4, 1.5), true);
    assert.equal(isBlankFrame(255, 0), true);
    assert.equal(isBlankFrame(252, 2), true);
    assert.equal(isBlankFrame(7, 10), false);
    assert.equal(isBlankFrame(18, 1), false);
    assert.equal(isBlankFrame(200, 2), false);
    assert.equal(isBlankFrame(Number.NaN, 0), true);
  });

  it("treats a fully transparent buffer as empty", () => {
    const pixels = new Uint8ClampedArray(16);
    assert.equal(frameLooksBlank(pixels, 4), true);
  });
});

describe("unreadable photo responses", () => {
  it("rejects a blank frame the model admits, including a made-up calorie guess", () => {
    assert.equal(isUnreadablePhoto({ no_food: true }), true);
    assert.equal(isUnreadablePhoto({ no_food: "true", meal_name: "Creatine", calories: 0 }), true);
    assert.equal(isUnreadablePhoto(meal({
      meal_name: "Unidentifiable (dark image)",
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    })), true);
    assert.equal(isUnreadablePhoto(meal({
      meal_name: "Unidentifiable (dark image)",
      calories: 520,
    })), true);
    assert.equal(isUnreadablePhoto(meal({ meal_name: "Blank image", calories: 80 })), true);
    assert.equal(isUnreadablePhoto(meal({ meal_name: "No food visible", calories: 0 })), true);
    assert.equal(isUnreadablePhoto(meal({
      meal_name: "Snack",
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      edge_comment: "The image is too dark to see any food.",
    })), true);
  });

  it("keeps genuine zero-calorie foods", () => {
    const creatine = meal({
      meal_name: "Creatine",
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      edge_comment: "I can't see this moving your protein total. Still worth logging.",
    });
    const coffee = meal({
      meal_name: "Black coffee",
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      edge_comment: "Black coffee, no calories. Protein still needs to come from food.",
    });
    assert.equal(isUnreadablePhoto(creatine), false);
    assert.equal(isUnreadablePhoto(coffee), false);
    assert.deepEqual(mealFromAnalysis(creatine), {
      meal_name: "Creatine",
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      edge_comment: creatine.edge_comment,
    });
    assert.equal(mealFromAnalysis(coffee)?.calories, 0);
    assert.equal(isUnreadablePhoto(meal({ meal_name: "Dark chocolate brownie", calories: 420 })), false);
    assert.equal(isUnreadablePhoto(meal({ meal_name: "Black pudding and eggs", calories: 390 })), false);
    assert.equal(isUnreadablePhoto(meal({
      edge_comment: "Bit of a dark photo, but that looks like chicken and rice.",
    })), false);
  });

  it("does not treat a broken model payload as a savable meal", () => {
    assert.equal(mealFromAnalysis({ no_food: true }), null);
    assert.equal(mealFromAnalysis({ meal_name: "Creatine", calories: 0 }), null);
    assert.deepEqual(parseModelJson('```json\n{"no_food": true}\n```'), { no_food: true });
  });
});

describe("server photo inspection", () => {
  it("flags solid black and white JPEGs and keeps a dark photo with a subject", async () => {
    assert.equal(await inspectMealPhoto(await solidJpeg(0, 0, 0)), "blank");
    assert.equal(await inspectMealPhoto(await solidJpeg(255, 255, 255)), "blank");
    assert.equal(await inspectMealPhoto("not-a-photo"), "unreadable");
    assert.equal(await inspectMealPhoto(""), "unreadable");

    const width = 64;
    const height = 64;
    const raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        const onLabel = x >= 40 && x < 58 && y >= 8 && y < 28;
        raw[i] = onLabel ? 210 : 6;
        raw[i + 1] = onLabel ? 180 : 5;
        raw[i + 2] = onLabel ? 90 : 4;
      }
    }
    const dark = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 82 }).toBuffer();
    assert.equal(await inspectMealPhoto(dark.toString("base64")), "ok");

    const plate = Buffer.alloc(width * height * 3);
    for (let i = 0; i < plate.length; i += 3) {
      plate[i] = 40 + (i % 90);
      plate[i + 1] = 80 + (i % 50);
      plate[i + 2] = 30 + (i % 40);
    }
    const colour = await sharp(plate, { raw: { width, height, channels: 3 } }).jpeg({ quality: 82 }).toBuffer();
    assert.equal(await inspectMealPhoto(colour.toString("base64")), "ok");
  });
});

describe("analyse route refuses a black frame before saving", () => {
  const route = readFileSync("app/api/nutrition/analyze/route.ts", "utf8");
  const page = readFileSync("app/(app)/nutrition/page.tsx", "utf8");

  it("checks the pixels and the model reply before the insert, and drops the best-guess rule", () => {
    const inspectAt = route.indexOf("inspectMealPhoto(");
    const capAt = route.indexOf("enforceDailyCap(");
    const modelAt = route.indexOf("messages.create");
    const unreadAt = route.indexOf("isUnreadablePhoto(");
    const insertAt = route.indexOf(".insert(");
    assert.ok(inspectAt > 0 && capAt > inspectAt && modelAt > capAt);
    assert.ok(unreadAt > modelAt && insertAt > unreadAt);
    assert.equal(route.includes("give your best guess"), false);
    assert.match(route, /\{"no_food": true\}/);
    assert.match(route, /creatine/);
    assert.match(route, /black coffee/);
    assert.match(route, /status: 422/);
  });

  it("asks the client to try again and does not upload a full-size data URL", () => {
    assert.match(BLANK_PHOTO_MESSAGE, /Try again/);
    assert.match(NO_FOOD_MESSAGE, /Try again/);
    assert.match(page, /prepareMealPhoto/);
    assert.match(page, /BLANK_PHOTO_MESSAGE/);
    assert.equal(page.includes("readAsDataURL"), false);
    assert.equal(page.includes("resizeImage"), false);
  });
});
