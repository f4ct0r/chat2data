import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App connection sidebar wiring', () => {
  it('tracks connection-list collapse state and renders the focused sidebar layout component', () => {
    const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

    expect(source).toContain("const [isConnectionListCollapsed, setIsConnectionListCollapsed] = useState(false);");
    expect(source).toContain("import ConnectionWorkspaceSidebar from './components/ConnectionList/ConnectionWorkspaceSidebar';");
    expect(source).toContain('resolveConnectionListCollapsedState');
    expect(source).toContain('<ConnectionWorkspaceSidebar');
  });
});
