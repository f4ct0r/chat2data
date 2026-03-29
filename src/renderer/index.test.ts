import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('renderer tab layout styles', () => {
  it('only stretches active workspace tab panes', () => {
    const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

    expect(css).toContain('.workspace-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active');
    expect(css).toContain('.chat2data-sql-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active');
    expect(css).not.toContain('.workspace-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane {\n  height: 100%;\n  flex: 1;\n  display: flex;');
    expect(css).not.toContain('.chat2data-sql-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane {\n  height: 100%;\n  flex: 1;\n  min-height: 0;\n  display: flex;');
  });

  it('keeps the global stylesheet braces balanced so Vite can parse it', () => {
    const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');
    const openingBraces = css.match(/{/g)?.length ?? 0;
    const closingBraces = css.match(/}/g)?.length ?? 0;

    expect(closingBraces).toBe(openingBraces);
  });
});
