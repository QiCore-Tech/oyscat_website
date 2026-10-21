import assert from "node:assert/strict"
import { createServer } from "node:http"
import { after, beforeEach, describe, test } from "node:test"
import vercelHandler, { createApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { createRateLimiter } from "../src/rate-limit.js"

const CONFIGURED_ENV = {
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "bot@example.com",
  SMTP_PASS: "secret",
  SUBSCRIBE_NOTIFY_EMAIL: "team@example.com",
}

async function startServer({ env = CONFIGURED_ENV, mailer, maxGlobal } = {}) {
  const config = loadConfig(env)
  const limiter = createRateLimiter({
    windowMs: config.rateLimit.windowMs,
    maxPerKey: config.rateLimit.maxPerIp,
    maxGlobal: maxGlobal ?? config.rateLimit.maxGlobal,
  })
  const silentLogger = { warn() {}, error() {} }
  const app = createApp({ config, mailer, limiter, logger: silentLogger })
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return {
    post(body, headers = {}) {
      return fetch(`${baseUrl}/api/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    },
    close() {
      limiter.close()
      return new Promise((resolve) => server.close(resolve))
    },
  }
}

function fakeMailer() {
  const sent = []
  return { sent, async send(message) { sent.push(message) } }
}

describe("POST /api/subscribe", () => {
  let mailer
  let server

  beforeEach(async () => {
    await server?.close()
    mailer = fakeMailer()
    server = await startServer({ mailer })
  })

  after(() => server?.close())

  test("mails the team inbox once, then rate-limits the same IP", async () => {
    const first = await server.post({ email: " visitor@example.com ", locale: "en" }, { "x-forwarded-for": "203.0.113.7" })
    assert.equal(first.status, 200)
    assert.deepEqual(await first.json(), { status: "SUBSCRIBED" })
    assert.equal(first.headers.get("cache-control"), "no-store")

    assert.equal(mailer.sent.length, 1)
    const [message] = mailer.sent
    assert.equal(message.to, "team@example.com")
    assert.equal(message.replyTo, "visitor@example.com")
    assert.equal(message.subject, "Oyscat 新订阅: visitor@example.com")
    assert.match(message.text, /订阅邮箱: visitor@example\.com\n/)
    assert.match(message.text, /提交时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC\n/)
    assert.match(message.text, /页面语言: en\n/)

    const second = await server.post({ email: "other@example.com" }, { "x-forwarded-for": "203.0.113.7" })
    assert.equal(second.status, 429)
    assert.equal((await second.json()).error.code, "RATE_LIMIT_EXCEEDED")
    assert.ok(Number(second.headers.get("retry-after")) > 0)
    assert.equal(mailer.sent.length, 1)
  })

  test("counts each forwarded client IP separately", async () => {
    assert.equal((await server.post({ email: "a@example.com" }, { "x-forwarded-for": "198.51.100.1" })).status, 200)
    assert.equal((await server.post({ email: "b@example.com" }, { "x-forwarded-for": "198.51.100.2" })).status, 200)
    assert.equal(mailer.sent.length, 2)
  })

  test("defaults the page language line to unknown", async () => {
    assert.equal((await server.post({ email: "a@example.com" })).status, 200)
    assert.match(mailer.sent[0].text, /页面语言: unknown\n/)
  })

  for (const [name, body] of [
    ["an invalid email", { email: "not-an-email" }],
    ["an email over 254 characters", { email: `${"a".repeat(250)}@example.com` }],
    ["an unknown locale", { email: "a@example.com", locale: "fr" }],
    ["extra keys", { email: "a@example.com", name: "x" }],
    ["a missing email", {}],
  ]) {
    test(`rejects ${name} with 400 without using the IP's slot`, async () => {
      const response = await server.post(body)
      assert.equal(response.status, 400)
      assert.equal((await response.json()).error.code, "SUBSCRIBE_INVALID")
      assert.equal((await server.post({ email: "a@example.com" })).status, 200)
    })
  }

  test("rejects malformed JSON with 400", async () => {
    const response = await server.post("{not json")
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: { code: "SUBSCRIBE_INVALID", message: "订阅内容格式不正确" } })
  })
})

describe("POST /api/subscribe failure modes", () => {
  let server

  after(() => server?.close())

  test("answers 503 when SMTP is not configured", async () => {
    server = await startServer({ env: {}, mailer: fakeMailer() })
    const response = await server.post({ email: "a@example.com" })
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error.code, "SUBSCRIBE_UNAVAILABLE")
    await server.close()
    server = undefined
  })

  test("answers 502 when sending fails, and still holds the IP's slot", async () => {
    const failing = { async send() { throw new Error("smtp down") } }
    server = await startServer({ mailer: failing })
    const response = await server.post({ email: "a@example.com" })
    assert.equal(response.status, 502)
    assert.equal((await response.json()).error.code, "SUBSCRIBE_SEND_FAILED")
    assert.equal((await server.post({ email: "a@example.com" })).status, 429)
    await server.close()
    server = undefined
  })

  test("caps total sends per window across all IPs", async () => {
    const mailer = fakeMailer()
    server = await startServer({ mailer, maxGlobal: 2 })
    assert.equal((await server.post({ email: "a@example.com" }, { "x-forwarded-for": "192.0.2.1" })).status, 200)
    assert.equal((await server.post({ email: "b@example.com" }, { "x-forwarded-for": "192.0.2.2" })).status, 200)
    assert.equal((await server.post({ email: "c@example.com" }, { "x-forwarded-for": "192.0.2.3" })).status, 429)
    assert.equal(mailer.sent.length, 2)
    await server.close()
    server = undefined
  })
})

describe("POST /api/subscribe with OYSCAT_FORWARD_SECRET", () => {
  const secretEnv = { ...CONFIGURED_ENV, OYSCAT_FORWARD_SECRET: "s3cret" }
  let mailer
  let server

  beforeEach(async () => {
    await server?.close()
    mailer = fakeMailer()
    server = await startServer({ env: secretEnv, mailer })
  })

  after(() => server?.close())

  test("refuses requests without the secret or with a wrong one", async () => {
    for (const headers of [{}, { "x-oyscat-forward-secret": "wrong" }]) {
      const response = await server.post({ email: "a@example.com" }, headers)
      assert.equal(response.status, 403)
      assert.equal((await response.json()).error.code, "FORBIDDEN")
    }
    assert.equal(mailer.sent.length, 0)
  })

  test("rate-limits on the forwarded visitor address", async () => {
    const from = (ip) => ({ "x-oyscat-forward-secret": "s3cret", "x-oyscat-client-ip": ip })
    assert.equal((await server.post({ email: "a@example.com" }, from("198.51.100.10"))).status, 200)
    assert.equal((await server.post({ email: "b@example.com" }, from("198.51.100.11"))).status, 200)
    assert.equal((await server.post({ email: "c@example.com" }, from("198.51.100.10"))).status, 429)
    assert.equal(mailer.sent.length, 2)
  })
})

describe("loadConfig", () => {
  test("trusts X-Forwarded-For on Vercel and only loopback elsewhere", () => {
    assert.equal(loadConfig({ VERCEL: "1" }).trustProxy, true)
    assert.equal(loadConfig({}).trustProxy, "loopback")
    assert.equal(loadConfig({ TRUST_PROXY: "false", VERCEL: "1" }).trustProxy, false)
  })
})

describe("Vercel default export", () => {
  test("serves the app built from the environment", async () => {
    const server = createServer(vercelHandler)
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/health`)
      assert.deepEqual(await response.json(), { status: "ok" })
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})

describe("GET /health", () => {
  test("reports ok", async () => {
    const config = loadConfig({})
    const limiter = createRateLimiter({ windowMs: 60_000, maxPerKey: 1, maxGlobal: 20 })
    const app = createApp({ config, mailer: fakeMailer(), limiter })
    const server = await new Promise((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening))
    })
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/health`)
      assert.deepEqual(await response.json(), { status: "ok" })
    } finally {
      limiter.close()
      await new Promise((resolve) => server.close(resolve))
    }
  })
})
