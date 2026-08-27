declare module 'compression' {
  import type { RequestHandler } from 'express';

  interface CompressionOptions {
    threshold?: number | string;
    [key: string]: unknown;
  }

  function compression(options?: CompressionOptions): RequestHandler;
  export default compression;
}
