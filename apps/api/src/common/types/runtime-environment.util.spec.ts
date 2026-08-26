import { runtimeEnvironment, type RuntimeEnvironment } from './runtime-environment.util';

describe('runtimeEnvironment', () => {
  it.each<RuntimeEnvironment>(['development', 'test', 'production'])('sets one flag for %s', (name) => {
    const flags = runtimeEnvironment(name);

    expect([flags.isDevelopment, flags.isTest, flags.isProduction].filter(Boolean)).toHaveLength(1);
    expect(flags.name).toBe(name);
  });
});
