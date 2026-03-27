import { beforeEach, describe, expect, it, vi } from 'vitest';

const loaderConfig = vi.fn();
const bundledMonaco = {
  __bundled: true,
  editor: {},
  languages: {},
};

class MockEditorWorker {}
class MockJsonWorker {}
class MockCssWorker {}
class MockHtmlWorker {}
class MockTsWorker {}

vi.mock('@monaco-editor/react', async () => {
  const React = await import('react');

  return {
    __esModule: true,
    default: () => React.createElement('div'),
    loader: {
      config: loaderConfig,
    },
    useMonaco: () => null,
  };
});

vi.mock('monaco-editor', () => ({
  __esModule: true,
  ...bundledMonaco,
}));

vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({
  __esModule: true,
  default: MockEditorWorker,
}));

vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({
  __esModule: true,
  default: MockJsonWorker,
}));

vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({
  __esModule: true,
  default: MockCssWorker,
}));

vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({
  __esModule: true,
  default: MockHtmlWorker,
}));

vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({
  __esModule: true,
  default: MockTsWorker,
}));

describe('SqlEditor Monaco bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    loaderConfig.mockClear();
    delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment;
  });

  it('configures the Monaco loader to use the bundled monaco module instead of CDN paths', async () => {
    await import('./SqlEditor');

    expect(loaderConfig).toHaveBeenCalledTimes(1);
    expect(loaderConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        monaco: expect.objectContaining({
          __bundled: true,
        }),
      })
    );
    expect(loaderConfig.mock.calls[0][0]).not.toHaveProperty('paths');
  });

  it('installs a MonacoEnvironment worker router for bundled language workers', async () => {
    await import('./SqlEditor');

    const monacoEnvironment = (
      globalThis as typeof globalThis & {
        MonacoEnvironment?: {
          getWorker: (_moduleId: string, label: string) => unknown;
        };
      }
    ).MonacoEnvironment;

    expect(monacoEnvironment).toBeDefined();
    expect(monacoEnvironment?.getWorker('', 'json')).toBeInstanceOf(MockJsonWorker);
    expect(monacoEnvironment?.getWorker('', 'css')).toBeInstanceOf(MockCssWorker);
    expect(monacoEnvironment?.getWorker('', 'html')).toBeInstanceOf(MockHtmlWorker);
    expect(monacoEnvironment?.getWorker('', 'javascript')).toBeInstanceOf(MockTsWorker);
    expect(monacoEnvironment?.getWorker('', 'sql')).toBeInstanceOf(MockEditorWorker);
  });
});
