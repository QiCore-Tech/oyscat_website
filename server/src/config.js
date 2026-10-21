/** Reads the service settings from the environment (loaded from server/.env by `node --env-file-if-exists`). */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 4000,
    host: env.HOST || "127.0.0.1",
    // Express "trust proxy" value. The default trusts only the co-located Next server, so req.ip is the visitor it forwarded.
    trustProxy: env.TRUST_PROXY || "loopback",
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
