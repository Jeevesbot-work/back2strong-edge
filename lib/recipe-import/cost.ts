/**
 * Running cost of one import.
 * Apify's figure is the dollar amount the actor run reports.
 * Claude and image dollars are estimates from the published list prices
 * (Sonnet 4.6 at $3 / $15 per million tokens, gpt-image-1 1024px at about $0.04).
 */

const SONNET_INPUT_PER_M = 3;
const SONNET_OUTPUT_PER_M = 15;
const IMAGE_USD = 0.04;

export interface ImportCost {
  apifyUsd: number;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  claudeUsd: number;
  imagesGenerated: number;
  imagesFailed: number;
  imageUsd: number;
  totalUsd: number;
}

const blank = (): ImportCost => ({
  apifyUsd: 0,
  claudeInputTokens: 0,
  claudeOutputTokens: 0,
  claudeUsd: 0,
  imagesGenerated: 0,
  imagesFailed: 0,
  imageUsd: 0,
  totalUsd: 0,
});

let current = blank();

function retotal(): void {
  current.claudeUsd =
    (current.claudeInputTokens / 1_000_000) * SONNET_INPUT_PER_M +
    (current.claudeOutputTokens / 1_000_000) * SONNET_OUTPUT_PER_M;
  current.imageUsd = current.imagesGenerated * IMAGE_USD;
  current.totalUsd = current.apifyUsd + current.claudeUsd + current.imageUsd;
}

export function resetImportCost(): void {
  current = blank();
}

export function addApifyUsd(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  current.apifyUsd += amount;
  retotal();
}

export function addClaudeUsage(inputTokens: number, outputTokens: number): void {
  current.claudeInputTokens += Math.max(0, inputTokens);
  current.claudeOutputTokens += Math.max(0, outputTokens);
  retotal();
}

export function addImageAttempt(ok: boolean): void {
  if (ok) current.imagesGenerated += 1;
  else current.imagesFailed += 1;
  retotal();
}

export function importCost(): ImportCost {
  return { ...current };
}

export function formatCost(cost: ImportCost): string {
  const money = (n: number) => `$${n.toFixed(2)}`;
  return [
    `Cost: about ${money(cost.totalUsd)}.`,
    `Apify ${money(cost.apifyUsd)} (reported).`,
    `Claude ${cost.claudeInputTokens} in / ${cost.claudeOutputTokens} out, about ${money(cost.claudeUsd)}.`,
    `Images ${cost.imagesGenerated} generated, ${cost.imagesFailed} failed, about ${money(cost.imageUsd)}.`,
  ].join(" ");
}
