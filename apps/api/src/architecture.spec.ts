import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';

/**
 * Structural guardrails (Phase 3).
 *
 * These pin the module boundaries so a future change breaks a test rather than
 * a feature. They live in a test rather than in ESLint because ESLint 9's
 * `no-restricted-imports` did not apply the boundary globs reliably — see the
 * note in `eslint.config.mjs`.
 */

const MODULES_DIR = join(__dirname, 'modules');
const FEATURES = [
  'assessment', 'auth', 'blog', 'bookings', 'commerce', 'community', 'content', 'courses',
  'files', 'languages', 'learning', 'matching', 'notifications', 'settings', 'support', 'teachers', 'users',
] as const;
const MODULES = readdirSync(MODULES_DIR).filter((name) => statSync(join(MODULES_DIR, name)).isDirectory());

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

function imports(file: string) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const specs: string[] = [];
  source.forEachChild((node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    }
  });
  return specs;
}

/** Every (file, importSpecifier) pair under src/modules, specs excluded. */
function moduleImports() {
  return sourceFiles(MODULES_DIR).flatMap((file) => {
    return imports(file).map((spec) => ({ file: relative(__dirname, file), spec }));
  });
}

describe('module boundaries', () => {
  it('exposes every feature module as a directory under src/modules', () => {
    expect(MODULES.sort()).toEqual([...FEATURES].sort());
  });

  /**
   * A module may depend on another module's *top-level* surface
   * (`../commerce`, `../teachers/teachers.service`) because that is what the
   * owning module exports through Nest DI. Reaching into a nested folder
   * (`../commerce/payouts/earnings.service`) couples the importer to internal
   * layout the other module is free to change — and the `3b04c00` restructure
   * did exactly that kind of move.
   */
  it("never reaches into another module's internal folders (STR-202)", () => {
    const group = MODULES.join('|');
    // ../<module>/<something>/<something...>  — two or more segments deep.
    const deep = new RegExp(`^(?:\\.\\./)+(${group})/[^/]+/`);
    const violations = moduleImports()
      .filter(({ file, spec }) => {
        const match = deep.exec(spec);
        const owner = match?.[1];
        if (!owner) return false;
        // Importing deeply *within your own module* is fine.
        return !file.startsWith(`modules/${owner}/`);
      })
      .map(({ file, spec }) => `${file} -> ${spec}`);

    expect(violations).toEqual([]);
  });

  it('keeps the commerce public surface small and explicit', () => {
    const barrel = readFileSync(join(MODULES_DIR, 'commerce', 'index.ts'), 'utf8');
    const exported = [...barrel.matchAll(/export\s*\{\s*([^}]+)\}/g)].flatMap((m) =>
      (m[1] ?? '').split(',').map((s) => s.trim()),
    );
    expect(exported.sort()).toEqual([
      'AutoDiscountsService',
      'EarningsService',
      'WalletService',
      'releaseDiscount',
    ]);
  });

  /**
   * `common/` is the only thing every module is allowed to share. If a feature
   * module ever appears here, the shared layer has grown a dependency on a
   * feature and the direction of the graph has inverted.
   */
  it('keeps common/ free of any dependency on a feature module', () => {
    const group = MODULES.join('|');
    const intoModules = new RegExp(`(?:\\.\\./)+modules/(${group})\\b`);
    const violations = sourceFiles(join(__dirname, 'common')).flatMap((file) => {
      return imports(file)
        .filter((spec) => intoModules.test(spec))
        .map((spec) => `${relative(__dirname, file)} -> ${spec}`);
    });
    expect(violations).toEqual([]);
  });

  it('keeps operational and adapter concerns out of feature modules', () => {
    for (const name of ['health', 'queue', 'redis', 'logging', 'database', 'audit']) {
      expect(MODULES).not.toContain(name);
    }
  });

  it('does not model admin/backoffice as a business feature', () => {
    expect(MODULES).not.toContain('admin');
    expect(MODULES).not.toContain('backoffice');
    expect(() => statSync(join(__dirname, 'application', 'backoffice'))).toThrow();
  });

  it('keeps modules below cross-domain workflows', () => {
    const violations = moduleImports()
      .filter(({ spec }) => /application\/workflows/.test(spec))
      .map(({ file, spec }) => `${file} -> ${spec}`);
    expect(violations).toEqual([]);
  });

  it('keeps distributed admin controllers thin and adapter-free', () => {
    const controllerFiles = [join(__dirname, 'modules'), join(__dirname, 'application'), join(__dirname, 'system')]
      .flatMap(sourceFiles)
      .filter((file) => file.endsWith('.controller.ts') && /@Controller\('admin(?:\/|')/.test(readFileSync(file, 'utf8')));
    const violations = controllerFiles.flatMap((file) => imports(file)
      .filter((spec) => /infrastructure|\.repository$/.test(spec))
      .map((spec) => `${relative(__dirname, file)} -> ${spec}`));
    expect(violations).toEqual([]);
    expect(controllerFiles.filter((file) => !readFileSync(file, 'utf8').includes("@ApiTags('admin')"))).toEqual([]);
  });

  it('keeps the admin dashboard persistence boundary read-only', () => {
    const files = sourceFiles(join(__dirname, 'application', 'admin-dashboard'));
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/.test(source)
        ? [relative(__dirname, file)] : [];
    });
    expect(violations).toEqual([]);
  });

  it('keeps provider SDKs out of business and application code', () => {
    const roots = [join(__dirname, 'modules'), join(__dirname, 'application')];
    const violations = roots.flatMap(sourceFiles).flatMap((file) =>
      imports(file)
        .filter((spec) => ['bullmq', 'ioredis', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'].includes(spec))
        .map((spec) => `${relative(__dirname, file)} -> ${spec}`),
    );
    expect(violations).toEqual([]);
  });

  it('keeps concrete messaging providers out of feature modules', () => {
    const violations = moduleImports()
      .filter(({ spec }) => /kavenegar\.provider$/.test(spec))
      .map(({ file, spec }) => `${file} -> ${spec}`);

    expect(violations).toEqual([]);
  });
});
