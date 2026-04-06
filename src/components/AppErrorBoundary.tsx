import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-darker text-brand-light flex items-center justify-center px-4">
          <div className="max-w-lg w-full border border-gray-700 bg-brand-dark/90 rounded-sm p-8 text-center">
            <p className="text-brand-orange font-bold uppercase tracking-widest text-xs mb-3">Something went wrong</p>
            <h1 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-3">
              The page crashed unexpectedly
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              Please reload the page. If the issue continues, try again in a moment.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-6 py-3 rounded-sm transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
