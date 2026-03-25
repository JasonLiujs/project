import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { SDKProvider } from '../../hooks/useContext';

const App = lazy(() => import('./App'));

export default async function main() {
  await window.JSSDK.shared.setSharedModules({
    React,
    ReactDOM: window.ReactDOM,
  });

  const container = document.createElement('div');
  container.id = 'ai-tab-root';
  document.body.appendChild(container);
  const root = createRoot(container);

  root.render(
    <SDKProvider>
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b7280' }}>加载中...</div>}>
        <App />
      </Suspense>
    </SDKProvider>
  );
}
