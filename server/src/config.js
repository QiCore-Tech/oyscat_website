/** Reads the service settings from the environment (server/.env locally, the project's variables on Vercel). */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 4000,
    host: env.HOST || "127.0.0.1",
    trustProxy: parseTrustProxy(env),
    // Shared with the website (same variable there). When set, only requests carrying it are served, and the
    // visitor address they forward is used for rate limiting.
    forwardSecret: env.OYSCAT_FORWARD_SECRET ?? "",
    smtp: {
      host: env.SMTP_HOST || "smtp.163.com",
      port: Number(env.SMTP_PORT) || 465,
      user: env.SMTP_USER ?? "", // also the From address; 163 and Feishu reject a From that differs from the login
      pass: env.SMTP_PASS ?? "", // mailbox SMTP authorization code, not the login password
      timeoutMs: Number(env.SMTP_TIMEOUT_MS) || 10_000,
    },
    notifyEmail: env.SUBSCRIBE_NOTIFY_EMAIL ?? "", // recipient of new-subscriber notices
    rateLimit: {
      windowMs: 60_000,
      maxPerIp: 1,
      // Backstop for forged X-Forwarded-For values, which would otherwise give every request a fresh per-IP slot.
      maxGlobal: Number(env.SUBSCRIBE_GLOBAL_MAX_PER_MINUTE) || 20,
    },
  }
}

export function isMailConfigured(config) {
  return Boolean(config.smtp.user && config.smtp.pass && config.notifyEmail)
}

/**
 * Express "trust proxy" value. Locally it trusts only the co-located Next server, so req.ip is the visitor it
 * forwarded. On Vercel the platform overwrites X-Forwarded-For with the connecting client, so it is trusted as is.
 */
function parseTrustProxy(env) {
  const value = env.TRUST_PROXY?.trim()
  if (value === "true") return true
  if (value === "false") return false
  if (value) return value
  return env.VERCEL ? true : "loopback"
}
