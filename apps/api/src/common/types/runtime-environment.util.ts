export type RuntimeEnvironment = 'development' | 'test' | 'production';

export type RuntimeEnvironmentFlags = Readonly<{
  name: RuntimeEnvironment;
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
}>;

export function runtimeEnvironment(name: RuntimeEnvironment): RuntimeEnvironmentFlags {
  return {
    name,
    isDevelopment: name === 'development',
    isTest: name === 'test',
    isProduction: name === 'production',
  };
}
