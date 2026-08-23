import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#f87171',
          background: 'rgba(248, 113, 113, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(248, 113, 113, 0.3)',
        }}>
          <h3>{this.props.fallbackTitle || 'Something went wrong'}</h3>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
