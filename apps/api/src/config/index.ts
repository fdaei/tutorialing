import '../env';
import { envSchemaWithGuards } from './env.validation';

let cachedConfig: ReturnType<typeof envSchemaWithGuards.parse> | undefined;

export function config() {
  cachedConfig ??= envSchemaWithGuards.parse(process.env);
  return cachedConfig;
}
