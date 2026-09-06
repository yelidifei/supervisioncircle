declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CIRCLE_READ_ONLY?: string;
  }
}
