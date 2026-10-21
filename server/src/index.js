import { fileURLToPath } from "node:url"
import { createApp } from "./app.js"
import { createRuntime } from "./runtime.js"

// Local entry point: `pnpm dev` / `pnpm start`. On Vercel the default export of ./app.js is served instead.

// Loaded here rather than with --env-file-if-exists, which crashes `node --watch` when the file is missing.
// Variables already set in the environment win over the file.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)))
} catch (error) {
  if (error.code !== "ENOENT") throw error
}

const { config, mailer, limiter } = createRuntime()
const app = createApp({ config, mailer, limiter })

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
