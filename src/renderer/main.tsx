import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp, Button, Result, ConfigProvider, theme } from 'antd';
import App from './App';
import GlobalErrorPrompt from './components/GlobalErrorPrompt/GlobalErrorPrompt';
import { I18nContext, I18nProvider } from './i18n/I18nProvider';
import './index.css';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? error.message : undefined;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
};

interface RootErrorBoundaryProps {
  children: React.ReactNode;
}

interface RootErrorBoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends React.Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  declare context: React.ContextType<typeof I18nContext>;
  static contextType = I18nContext;

  public state: RootErrorBoundaryState = {
    error: null,
  };

  public static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Renderer render failed', error, errorInfo);
  }

  public render(): React.ReactNode {
    if (this.state.error) {
      const t = this.context?.t ?? ((value: string) => value);
      return (
        <div className="flex h-screen items-center justify-center bg-[#0a0a0a] p-6 text-[#a3a3a3]">
          <Result
            status="error"
            title={<span className="text-[#FF5722]">{t('root.renderFailed')}</span>}
            subTitle={<span className="text-[#a3a3a3]">{this.state.error.message}</span>}
            extra={
              <Button type="primary" onClick={() => window.location.reload()} className="font-mono">
                {t('root.reload')}
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

window.addEventListener('error', (event) => {
  console.error('Unhandled window error', getErrorMessage(event.error ?? event.message));
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element "#root" not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#FF5722',
          colorBgBase: '#0a0a0a',
          colorBgContainer: '#121212',
          colorBgElevated: '#1a1a1a',
          colorTextBase: '#a3a3a3',
          colorTextSecondary: '#737373',
          fontFamily: "'Courier New', Courier, monospace",
          borderRadius: 2,
        },
        components: {
          Card: {
            colorBgContainer: '#121212',
            colorBorderSecondary: '#333333',
          },
          Button: {
            colorPrimary: '#FF5722',
            colorPrimaryHover: '#E64A19',
          }
        }
      }}
    >
      <AntdApp>
        <I18nProvider>
          <RootErrorBoundary>
            <GlobalErrorPrompt />
            <App />
          </RootErrorBoundary>
        </I18nProvider>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
