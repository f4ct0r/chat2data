import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SettingsModal Form.List field rendering', () => {
  it('does not spread Form.List field metadata into multiple sibling Form.Item nodes', () => {
    const source = readFileSync(resolve(__dirname, 'SettingsModal.tsx'), 'utf8');

    expect(source).not.toContain('{...field}');
  });

  it('includes a persisted app language field in the settings form', () => {
    const source = readFileSync(resolve(__dirname, 'SettingsModal.tsx'), 'utf8');

    expect(source).toContain("name=\"language\"");
    expect(source).toContain('window.api.settings.getAppLanguage()');
    expect(source).toContain('window.api.settings.setAppLanguage');
  });
});
