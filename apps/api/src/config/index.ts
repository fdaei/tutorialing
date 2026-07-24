import '../env';
import { envSchema } from './env.validation';

let cachedConfig: ReturnType<typeof envSchema.parse> | undefined;

export function config() {
  cachedConfig ??= envSchema.parse(process.env);
  return cachedConfig;
}
