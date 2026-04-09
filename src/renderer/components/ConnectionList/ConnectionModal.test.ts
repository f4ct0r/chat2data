import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ConnectionModal sqlite form wiring', () => {
  it('offers sqlite as a selectable database type', () => {
    const source = readFileSync(resolve(__dirname, 'ConnectionModal.tsx'), 'utf8');

    expect(source).toContain('<Select.Option value="sqlite">SQLite</Select.Option>');
  });

  it('switches sqlite connections to a file-path oriented form', () => {
    const source = readFileSync(resolve(__dirname, 'ConnectionModal.tsx'), 'utf8');

    expect(source).toContain("const isSqlite = Form.useWatch('dbType', form) === 'sqlite';");
    expect(source).toContain("label={isSqlite ? t('connectionModal.databasePath') : t('connectionModal.database')}");
    expect(source).toContain("{ required: isSqlite, message: t('connectionModal.databasePathRequired') }");
    expect(source).toContain('{!isSqlite ? (');
  });
});
