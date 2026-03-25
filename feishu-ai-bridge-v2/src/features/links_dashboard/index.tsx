import React, { lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { SDKProvider } from '../../hooks/useContext';

const App = lazy(() => import('./App'));

export default async function main() {
  await window.JSSDK.shared.setSharedModules({
    React,
    ReactDOM: window.ReactDOM,
  });

  const container = document.createElement('div');
  container.id = 'links-root';
  document.body.appendChild(container);
  const root = createRoot(container);

  root.render(
    <SDKProvider>
      <App />
    </SDKProvider>
  );
}
