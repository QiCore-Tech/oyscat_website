import { fileURLToPath } from "node:url"
import { createApp } from "./app.js"
import { isMailConfigured, loadConfig } from "./config.js"
import { createMailer } from "./mailer.js"
import { createRateLimiter } from "./rate-limit.js"

// Loaded here rather than with --env-file-if-exists, which crashes `node --watch` when the file is missing.
// Variables already set in the environment win over the file.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)))
} catch (error) {
  if (error.code !== "ENOENT") throw error
}

const config = loadConfig()
if (!isMailConfigured(config)) {
  console.warn("SMTP_USER, SMTP_PASS or SUBSCRIBE_NOTIFY_EMAIL is empty: /api/subscribe will answer 503")
}

const limiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  maxPerKey: config.rateLimit.maxPerIp,
  maxGlobal: config.rateLimit.maxGlobal,
})
const app = createApp({ config, mailer: createMailer(config.smtp), limiter })

const server = app.listen(config.port, config.host, (error) => {
  if (error) throw error
  console.log(`oyscat subscribe service listening on http://${config.host}:${config.port}`)
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    limiter.close()
    server.close(() => process.exit(0))
  })
}
