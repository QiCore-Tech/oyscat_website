import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    // Other hosts the dev server is opened from, e.g. a LAN IP (comma-separated; set in .env.development.local).
    ...(process.env.OYSCAT_DEV_ALLOWED_ORIGINS?.split(",").map((host) => host.trim()).filter(Boolean) ?? []),
  ],
  async redirects() {
    // The page used to live at /introduce in soha_stack; a permanent redirect hands old links (and their ranking) to /.
    return [{ source: "/introduce", destination: "/", permanent: true }]
  },
}

export default withNextIntl(nextConfig)
