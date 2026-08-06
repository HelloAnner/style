/**
 * 全局错误边界组件
 * 
 * 捕获 React 组件树中的 JavaScript 错误，防止整个应用崩溃
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // 自定义错误展示
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  // 错误上报回调
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  // 是否显示详细错误信息（开发模式）
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // 调用错误上报回调
    this.props.onError?.(error, errorInfo);
    
    // 开发环境打印详细错误
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] 捕获到错误:', error);
      console.error('[ErrorBoundary] 组件堆栈:', errorInfo.componentStack);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails } = this.props;

    if (!hasError || !error) {
      return children;
    }

    // 使用自定义 fallback
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error, this.resetError);
      }
      return fallback;
    }

    // 默认错误展示
    return (
      <div
        data-testid="error-boundary-fallback"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          minHeight: 200,
          background: 'var(--bg-secondary, #1a1a1a)',
          borderRadius: 8,
          margin: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 24 }}>⚠️</span>
        </div>
        
        <h3
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary, #fff)',
          }}
        >
          页面出现错误
        </h3>
        
        <p
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 14,
            color: 'var(--text-muted, #888)',
            textAlign: 'center',
          }}
        >
          抱歉，此区域出现了一些问题
        </p>
        
        <button
          data-testid="error-boundary-retry"
          onClick={this.resetError}
          style={{
            padding: '8px 16px',
            background: 'var(--accent-color, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          重试
        </button>
        
        {/* 开发模式显示详细错误 */}
        {(showDetails || import.meta.env.DEV) && (
          <details
            data-testid="error-boundary-details"
            style={{
              marginTop: 16,
              width: '100%',
              maxWidth: 600,
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-muted, #888)',
              }}
            >
              查看错误详情
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: 4,
                fontSize: 11,
                color: '#ef4444',
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {error.toString()}
              {errorInfo?.componentStack && (
                <>
                  {'\n\n组件堆栈:\n'}
                  {errorInfo.componentStack}
                </>
              )}
            </pre>
          </details>
        )}
      </div>
    );
  }
}

/**
 * 页面级错误边界（更大的展示区域）
 */
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={(error, resetError) => (
        <div
          data-testid="page-error-boundary-fallback"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-primary, #0a0a0a)',
            padding: 32,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 40 }}>😵</span>
          </div>
          
          <h2
            style={{
              margin: 0,
              marginBottom: 12,
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--text-primary, #fff)',
            }}
          >
            页面崩溃了
          </h2>
          
          <p
            style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 15,
              color: 'var(--text-muted, #888)',
              textAlign: 'center',
              maxWidth: 400,
            }}
          >
            抱歉，页面出现了意外错误。您可以尝试刷新页面或重试。
          </p>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              data-testid="page-error-boundary-refresh"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: 'var(--accent-color, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              刷新页面
            </button>
            <button
              data-testid="page-error-boundary-retry"
              onClick={resetError}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                color: 'var(--text-secondary, #aaa)',
                border: '1px solid var(--border-subtle, #333)',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
          
          {import.meta.env.DEV && (
            <pre
              style={{
                marginTop: 32,
                padding: 16,
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 8,
                fontSize: 12,
                color: '#ef4444',
                maxWidth: '90%',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {error.toString()}
            </pre>
          )}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

/**
 * 组件级错误边界（轻量级展示）
 */
export const ComponentErrorBoundary: React.FC<{
  children: ReactNode;
  name?: string;
}> = ({ children, name }) => {
  return (
    <ErrorBoundary
      fallback={(_error, resetError) => (
        <div
          data-testid="component-error-boundary-fallback"
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.05)',
            borderRadius: 6,
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>
              {name ? `${name} 加载失败` : '组件加载失败'}
            </span>
          </div>
          <button
            data-testid="component-error-boundary-retry"
            onClick={resetError}
            style={{
              padding: '4px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
