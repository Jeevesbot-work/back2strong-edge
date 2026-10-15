import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Sends a Web Push notification to every device a client has subscribed.
 * Best-effort: a failure never blocks the action that triggered it.
 * Subscriptions the browser has expired (404/410) are removed.
 * Returns how many devices received it.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:nick@back2strong.online";
  if (!vapidPublic || !vapidPrivate) return 0;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createServiceClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs) return 0;

  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      delivered++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("[push] coach message send error:", statusCode, err);
      }
    }
  }
  return delivered;
}

/** Notification for a message Nick has sent into a client's Edge chat. */
export function coachMessagePush(content: string): PushPayload {
  const text = content.replace(/\s+/g, " ").trim();
  return {
    title: "Message from Nick",
    body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
    url: "/edge",
    tag: "coach-message",
  };
}
