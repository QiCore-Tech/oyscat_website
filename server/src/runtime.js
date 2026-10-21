import { isMailConfigured, loadConfig } from "./config.js"
import { createMailer } from "./mailer.js"
import { createRateLimiter } from "./rate-limit.js"

/** Builds the service's dependencies from the environment; shared by the local server and the Vercel handler. */
export function createRuntime(env = process.env) {
  const config = loadConfig(env)
  if (!isMailConfigured(config)) {
    console.warn("SMTP_USER, SMTP_PASS or SUBSCRIBE_NOTIFY_EMAIL is empty: /api/subscribe will answer 503")
  }
  const limiter = createRateLimiter({
    windowMs: config.rateLimit.windowMs,
    maxPerKey: config.rateLimit.maxPerIp,
    maxGlobal: config.rateLimit.maxGlobal,
  })
  return { config, mailer: createMailer(config.smtp), limiter }
}
