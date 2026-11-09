
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
];
/** @type {import("next").NextConfig} */
const config = {
  poweredByHeader: false,
  serverExternalPackages: ["pdfkit", "exceljs", "pg", "bcryptjs"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/pdfkit/**/*",
      "./public/**/*",
    ],
  },
  devIndicators: false,
  async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; },
};
export default config;
