import { createHash, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { isMailConfigured } from "./config.js"

const subscribeSchema = z.object({
  email: z.string().trim().email().max(254),
  locale: z.enum(["zh-CN", "en"]).optional(),
}).strict()

/**
 * POST /api/subscribe: mails a new-subscriber notice to the team inbox, at most once a minute per client IP.
 * The page footer only distinguishes 2xx, 429 and everything else, so keep those statuses stable.
 */
export function createSubscribeHandler({ config, mailer, limiter, logger = console }) {
  return async function subscribe(req, res) {
    const clientIp = resolveClientIp(req, config.forwardSecret)
    if (clientIp === null) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden")
    }

    const parsed = subscribeSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, 400, "SUBSCRIBE_INVALID", "请填写有效的邮箱地址")
    }

    if (!isMailConfigured(config)) {
      return sendError(res, 503, "SUBSCRIBE_UNAVAILABLE", "订阅邮件服务未配置")
    }

    // The slot is taken before sending, so a failed send still blocks retries for the window and can't hammer SMTP.
    const retryAfter = limiter.take(clientIp)
    if (retryAfter) {
      res.set("retry-after", String(retryAfter))
      return sendError(res, 429, "RATE_LIMIT_EXCEEDED", "提交太频繁，请稍后再试")
    }

    const { email, locale } = parsed.data
    try {
      await mailer.send({
        to: config.notifyEmail,
        subject: `Oyscat 新订阅: ${email}`,
        text: [
          "有新用户订阅了产品动态。",
          "",
          `订阅邮箱: ${email}`,
          `提交时间: ${formatUtc(new Date())}`,
          `页面语言: ${locale ?? "unknown"}`,
          "来源页面: /",
          "",
        ].join("\n"),
        replyTo: email,
      })
    } catch (error) {
      logger.warn(`Subscribe notice mail failed for ${maskEmail(email)}:`, error)
      return sendError(res, 502, "SUBSCRIBE_SEND_FAILED", "订阅邮件发送失败")
    }

    res.json({ status: "SUBSCRIBED" })
  }
}

export function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } })
}

/**
 * The rate-limit key for a request, or null when the request must be refused.
 * When the website and this service are separate Vercel deployments, Vercel rewrites X-Forwarded-For on the hop
 * between them to the website's own address, so the visitor's address only survives in x-oyscat-client-ip.
 * The shared secret is what makes that header trustworthy; without a secret configured, req.ip is used.
 */
function resolveClientIp(req, secret) {
  if (!secret) return req.ip ?? "unknown"
  if (!sameSecret(req.get("x-oyscat-forward-secret") ?? "", secret)) return null
  return req.get("x-oyscat-client-ip")?.trim() || req.ip || "unknown"
}

function sameSecret(received, expected) {
  // Comparing digests keeps the comparison constant-time regardless of the received length.
  const digest = (value) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(received), digest(expected))
}

function formatUtc(date) {
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`
}

function maskEmail(email) {
  const at = email.lastIndexOf("@")
  const local = email.slice(0, at)
  return `${local.length > 1 ? `${local[0]}***` : "*"}${email.slice(at)}`
}
