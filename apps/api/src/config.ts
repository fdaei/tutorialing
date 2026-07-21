import './env';
import { z } from 'zod';
const schema=z.object({NODE_ENV:z.enum(['development','test','production']).default('development'),PORT:z.coerce.number().int().positive().default(4000),DATABASE_URL:z.string().min(1),REDIS_URL:z.string().url(),JWT_ACCESS_SECRET:z.string().min(32),JWT_REFRESH_SECRET:z.string().min(32),WEB_URL:z.string().url(),API_URL:z.string().url().optional(),KAVENEGAR_API_KEY:z.string().optional(),ZARINPAL_MERCHANT_ID:z.string().optional(),S3_ENDPOINT:z.string().url(),S3_ACCESS_KEY:z.string(),S3_SECRET_KEY:z.string(),S3_BUCKET:z.string()});
export type AppConfig=z.infer<typeof schema>;
let cached:AppConfig|undefined;
export function config():AppConfig{if(!cached){const result=schema.safeParse(process.env);if(!result.success)throw new Error(`Invalid environment: ${result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(', ')}`);cached=result.data}return cached}
