import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../electron-builder.config.cjs');
const packageJson = require('../package.json');

describe('electron-builder database exclusions', () => {
  it('excludes local database files from packaged artifacts', () => {
    expect(config.files).toEqual(
      expect.arrayContaining([
        '!**/*.sqlite',
        '!**/*.sqlite3',
        '!**/*.db',
      ])
    );
  });

  it('runs a build guard before packaging', () => {
    expect(packageJson.scripts['prepack:guard']).toContain('assert-no-bundled-databases');
    expect(packageJson.scripts.build).toContain('npm run prepack:guard');
    expect(packageJson.scripts['build:mac']).toContain('npm run prepack:guard');
    expect(packageJson.scripts['build:win']).toContain('npm run prepack:guard');
  });
});
