/**
 * Save a finished coach reply. Call this before closing the response stream:
 * once the stream closes, the serverless function can freeze before the insert.
 * Empty replies are not written. Failures are logged and not thrown, so a
 * database error still lets the client finish reading the text they already have.
 */
export async function saveCompletedReply(
  content: string,
  insert: (text: string) => Promise<{ message: string } | null>,
): Promise<"saved" | "empty" | "failed"> {
  const text = content.trim();
  if (!text) {
    console.error("[edge] assistant reply was empty; nothing saved");
    return "empty";
  }
  try {
    const error = await insert(text);
    if (error) {
      console.error("[edge] failed to save assistant reply:", error.message);
      return "failed";
    }
    return "saved";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[edge] failed to save assistant reply:", message);
    return "failed";
  }
}
