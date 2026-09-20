import '@fontsource-variable/inter';
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './landing';
import './globals.css';
import './landing.css';
import './theme.css';
const Profiler = lazy(() => import('./page'));
const currentPath = window.location.pathname.replace(/\/$/, '').toLowerCase();
const isProfiler =
  currentPath === '/profiler' || currentPath.startsWith('/profiler/');
document.title = isProfiler
  ? 'Wallet Profiler | OnChain'
  : 'OnChain | Ethereum Wallet Analytics';
createRoot(document.getElementById('root')!).render(
  isProfiler ? (
      <Suspense
        fallback={
          <main className="page" role="status">
            Loading wallet profiler…
          </main>
        }
      >
        <Profiler />
      </Suspense>
  ) : (
    <Landing />
  ),
);
