import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level renderer error boundary. A thrown render error would otherwise
 * unmount the whole React tree and leave a blank window; here we catch it and
 * offer recovery. Meeting data is safe — it lives in the local SQLite DB, not
 * in component state.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer crash:', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="h-screen flex items-center justify-center bg-surface-cloud text-ink-primary p-8">
        <div className="max-w-md text-center">
          <h1 className="text-h3 font-display mb-2">Something went wrong</h1>
          <p className="text-body text-ink-secondary mb-4">
            Oli hit an unexpected error. Your meetings and notes are safe — they’re stored locally.
          </p>
          <pre className="text-caption text-ink-muted bg-white border border-line rounded-lg p-3 mb-5 overflow-auto max-h-40 text-left whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-oli-blue text-white text-body font-medium"
            >
              Reload Oli
            </button>
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-lg bg-white border border-line text-body font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
