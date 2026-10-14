declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ATELIER_BROADCAST_TOKEN?: string;
    CONNECTORS?: any;
  }
}
