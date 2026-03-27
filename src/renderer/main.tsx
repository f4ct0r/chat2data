import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp, Button, Result, ConfigProvider, theme } from 'antd';
import App from './App';
import GlobalErrorPrompt from './components/GlobalErrorPrompt/GlobalErrorPrompt';
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
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-6 text-[#a3a3a3]">
          <Result
            status="error"
            title={<span className="text-[#FF5722]">应用渲染失败</span>}
            subTitle={<span className="text-[#a3a3a3]">{this.state.error.message}</span>}
            extra={
              <Button type="primary" onClick={() => window.location.reload()} className="font-mono">
                [ 重新加载 ]
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
        <RootErrorBoundary>
          <GlobalErrorPrompt />
          <App />
        </RootErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
