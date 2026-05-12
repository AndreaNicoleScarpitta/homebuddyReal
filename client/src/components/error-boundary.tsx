import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Label used in console logs so we can tell which boundary caught it. */
  scope?: string;
  /** Compact mode: render a non-fullscreen inline fallback (for per-page boundaries). */
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Surface render errors with component stack to the browser console so we
    // can debug them from user reports. In production this also reaches our
    // log drain because we relay console.error through a Sentry-ish pipeline
    // (see analytics.ts). Avoid throwing from here — React will remount.
    const scope = this.props.scope || "app";
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${scope}] caught render error:`, error, errorInfo?.componentStack);
  }

  private handleReset = () => {
    // Let the user retry without a full reload. If the error is deterministic
    // (stale query data, network issue that's since resolved) this gets them
    // back to a working UI cheaply.
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.props.inline) {
        return (
          <div className="flex items-center justify-center p-8" data-testid="error-boundary-inline">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-heading font-semibold mb-2">This section couldn't load</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Something went wrong rendering this page. Try again, or reload.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  data-testid="button-retry-page"
                  onClick={this.handleReset}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground px-3 py-2 hover:bg-primary/90"
                >
                  Try again
                </button>
                <button
                  data-testid="button-refresh-page"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border px-3 py-2 hover:bg-accent"
                >
                  Reload
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background" data-testid="error-boundary">
          <div className="text-center max-w-md px-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-heading font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              data-testid="button-refresh-page"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
