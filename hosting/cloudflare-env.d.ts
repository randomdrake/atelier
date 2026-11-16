declare namespace Cloudflare {
  interface Env {
    ASSETS?: Fetcher;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ATELIER_BROADCAST_TOKEN?: string;
    CONNECTORS?: any;
  }
}
