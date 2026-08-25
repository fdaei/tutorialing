export type RuntimeEnvironment = 'development' | 'test' | 'production';

export type RuntimeEnvironmentFlags = Readonly<{
  name: RuntimeEnvironment;
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
}>;

/** Creates explicit environment flags from the already-validated NODE_ENV. */
export function runtimeEnvironment(name: RuntimeEnvironment): RuntimeEnvironmentFlags {
  return {
    name,
    isDevelopment: name === 'development',
    isTest: name === 'test',
    isProduction: name === 'production',
  };
}
