import React, { lazy } from 'react';
import { createRoot } from 'react-dom/client';

const App = lazy(() => import('./App'));

export default async function main() {
  await window.JSSDK.shared.setSharedModules({
    React,
    ReactDOM: window.ReactDOM,
  });

  const container = document.createElement('div');
  container.id = 'view-root';
  document.body.appendChild(container);
  const root = createRoot(container);

  root.render(<App />);
}
