import express from "express"
import { createRuntime } from "./runtime.js"
import { createSubscribeHandler, sendError } from "./subscribe.js"

export function createApp({ config, mailer, limiter, logger = console }) {
  const app = express()
  app.disable("x-powered-by")
  app.set("trust proxy", config.trustProxy)

  app.use((req, res, next) => {
    res.set("cache-control", "no-store")
    next()
  })

  app.get("/health", (req, res) => {
    res.json({ status: "ok" })
  })

  app.post(
    "/api/subscribe",
    express.json({ limit: "10kb" }),
    createSubscribeHandler({ config, mailer, limiter, logger }),
  )

  app.use((req, res) => {
    sendError(res, 404, "NOT_FOUND", "Not found")
  })

  // Express identifies error middleware by its four parameters, so `next` stays even though it is unused.
  app.use((error, req, res, next) => {
    if (error?.type === "entity.parse.failed") {
      return sendError(res, 400, "SUBSCRIBE_INVALID", "订阅内容格式不正确")
    }
    if (error?.status >= 400 && error.status < 500) {
      return sendError(res, error.status, "BAD_REQUEST", error.expose ? error.message : "Bad request")
    }
    logger.error(error)
    sendError(res, 500, "INTERNAL_ERROR", "Internal error")
  })

  return app
}

let vercelApp

/**
 * Vercel's Express preset deploys the first of app.js, index.js, server.js, src/app.js, … that imports express
 * (this file) and serves its default export. The app is built on the first request from the project's
 * environment variables, so importing this module (tests, the local server) has no side effects.
 */
export default function vercelHandler(req, res) {
  vercelApp ??= createApp(createRuntime())
  return vercelApp(req, res)
}
