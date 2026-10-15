export const ADMIN_EMAILS = [
  "n.adams3@icloud.com",
  "nicosmada3@googlemail.com",
  "nick@back2strong.online",
];

export const ADMIN_COOKIE = "b2s_admin_session";

export function configuredAdminKey(accessKey: string | undefined | null): string | undefined {
  if (typeof accessKey !== "string" || accessKey.length === 0) return undefined;
  return accessKey;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Cookie / key proof, or a signed-in admin email.
 * A missing access key never authorises anyone by itself.
 */
export function adminSessionAllowed(input: {
  accessKey: string | undefined | null;
  cookie: string | undefined | null;
  email: string | null | undefined;
}): boolean {
  const key = configuredAdminKey(input.accessKey);
  if (key && input.cookie === key) return true;
  return isAdminEmail(input.email);
}

export type AdminGateDecision =
  | { kind: "next"; setCookie: boolean }
  | { kind: "redirect"; pathname: string; setCookie: boolean; clearSearch: boolean; stripKey: boolean }
  | { kind: "rewrite"; setCookie: boolean }
  | { kind: "public" }
  | { kind: "deny"; status: 404 };

/**
 * Decision for `/`, `/admin` and `/api/admin`.
 * Root stays public. Admin paths are 404 unless the cookie matches a configured
 * key, the request presents that key, or the caller is a signed-in admin email.
 */
export function decideAdminGate(input: {
  pathname: string;
  accessKey: string | undefined | null;
  cookie: string | undefined | null;
  keyParam: string | null;
  stay: boolean;
  email: string | null | undefined;
}): AdminGateDecision {
  const isRoot = input.pathname === "/";
  const key = configuredAdminKey(input.accessKey);
  const cookieOk = !!key && input.cookie === key;
  const keyParamOk = !!key && input.keyParam === key;
  const emailOk = isAdminEmail(input.email);

  if (cookieOk) {
    if (isRoot) return { kind: "redirect", pathname: "/admin", setCookie: false, clearSearch: true, stripKey: false };
    return { kind: "next", setCookie: false };
  }

  if (keyParamOk) {
    if (input.stay) {
      if (isRoot) return { kind: "rewrite", setCookie: true };
      return { kind: "next", setCookie: true };
    }
    return {
      kind: "redirect",
      pathname: isRoot ? "/admin" : input.pathname,
      setCookie: true,
      clearSearch: false,
      stripKey: true,
    };
  }

  if (emailOk) {
    if (isRoot) return { kind: "redirect", pathname: "/admin", setCookie: !!key, clearSearch: true, stripKey: false };
    return { kind: "next", setCookie: !!key };
  }

  if (isRoot) return { kind: "public" };
  return { kind: "deny", status: 404 };
}
