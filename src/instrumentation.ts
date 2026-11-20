export function register() {
  if (typeof process !== "undefined" && process.env) {
    process.env.TZ = "Asia/Kolkata";
  }
}
