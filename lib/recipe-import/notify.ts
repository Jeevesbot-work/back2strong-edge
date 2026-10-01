const REVIEW_URL = "https://app.back2strong.online/admin/recipes";

/**
 * One note to Nick after a weekly import. Uses the Resend sender the app
 * already uses for audit and login mail. If that key is not on the runner,
 * the import still finishes and the summary says the email was skipped.
 */
export async function notifyDraftsReady(count: number): Promise<string> {
  if (count <= 0) return "no new drafts, so no notification was sent";
  const key = process.env.RESEND_API_KEY;
  if (!key) return "RESEND_API_KEY is not set on this runner, so no email was sent";

  const line = `${count} new recipes ready`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Nick Adams · Back2Strong <nick@back2strong.online>",
      to: ["nick@back2strong.online"],
      subject: line,
      text: `${line}\n\n${REVIEW_URL}`,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 180);
    return `email was not sent (${res.status}): ${detail}`;
  }
  return `emailed nick@back2strong.online: ${line}`;
}
