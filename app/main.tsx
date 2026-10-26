import '@fontsource-variable/inter';
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './landing';
import './globals.css';
import './landing.css';
import './theme.css';
const Profiler = lazy(() => import('./page'));

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unable to display wallet analysis:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="page">
          <section className="loading-error" role="alert">
            <h1>Unable to display this analysis</h1>
            <p>The page encountered an unexpected error while showing the wallet data.</p>
            <button className="secondary" type="button" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
const currentPath = window.location.pathname.replace(/\/$/, '').toLowerCase();
const isProfiler =
  currentPath === '/profiler' || currentPath.startsWith('/profiler/');
document.title = isProfiler
  ? 'Wallet Profiler | OnChain'
  : 'OnChain | Ethereum Wallet Analytics';
createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    {isProfiler ? (
      <Suspense
        fallback={
          <output className="page">
            Loading wallet profiler…
          </output>
        }
      >
        <Profiler />
      </Suspense>
    ) : (
      <Landing />
    )}
  </AppErrorBoundary>
);
