import { config } from './index';

export function filesConfig() {
  const env = config();
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    bucket: env.S3_BUCKET,
    maxUploadBytes: env.FILE_MAX_UPLOAD_BYTES,
    uploadUrlTtlSeconds: env.FILE_UPLOAD_URL_TTL_SECONDS,
    downloadUrlTtlSeconds: env.FILE_DOWNLOAD_URL_TTL_SECONDS,
  };
}
