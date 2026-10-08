import { NextRequest, NextResponse } from "next/server";
import { requireActiveClient } from "@/lib/ai/access";

// Look up a scanned barcode against Open Food Facts (free, strong UK coverage)
// and return clean macros. No AI, no cost — exact label data straight back.
export async function POST(req: NextRequest) {
  try {
    const access = await requireActiveClient();
    if (!access.ok) return access.response;

    const { barcode } = await req.json();
    if (!barcode || !/^\d{6,14}$/.test(String(barcode))) {
      return NextResponse.json({ error: "That doesn't look like a valid barcode." }, { status: 400 });
    }

    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,nutriments,serving_size,serving_quantity`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Back2Strong-Edge/1.0 (app.back2strong.online)" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Couldn't reach the food database. Try again." }, { status: 502 });
    }

    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const p = data.product;
    const n = p.nutriments || {};

    const num = (v: unknown): number => {
      const x = typeof v === "number" ? v : parseFloat(String(v));
      return isFinite(x) && x >= 0 ? x : 0;
    };

    const per100 = {
      calories: Math.round(num(n["energy-kcal_100g"])),
      protein_g: Math.round(num(n["proteins_100g"]) * 10) / 10,
      carbs_g: Math.round(num(n["carbohydrates_100g"]) * 10) / 10,
      fat_g: Math.round(num(n["fat_100g"]) * 10) / 10,
    };

    const hasServing = n["energy-kcal_serving"] != null || p.serving_quantity != null;
    const perServing = hasServing
      ? {
          calories: Math.round(num(n["energy-kcal_serving"])),
          protein_g: Math.round(num(n["proteins_serving"]) * 10) / 10,
          carbs_g: Math.round(num(n["carbohydrates_serving"]) * 10) / 10,
          fat_g: Math.round(num(n["fat_serving"]) * 10) / 10,
        }
      : null;

    // If per-100g is completely empty, the product has no usable macro data.
    if (per100.calories === 0 && per100.protein_g === 0 && per100.carbs_g === 0 && per100.fat_g === 0) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const name = [p.brands?.split(",")[0]?.trim(), p.product_name].filter(Boolean).join(" ") || "Scanned product";

    return NextResponse.json({
      found: true,
      product_name: name.slice(0, 80),
      serving_size: p.serving_size || null,
      serving_quantity: p.serving_quantity ? num(p.serving_quantity) : null,
      per_100g: per100,
      per_serving: perServing,
    });
  } catch (err) {
    console.error("[barcode] error:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
