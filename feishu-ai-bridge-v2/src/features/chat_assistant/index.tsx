import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const App = lazy(() => import('./App'));

export default async function main() {
  await window.JSSDK.shared.setSharedModules({
    React,
    ReactDOM: window.ReactDOM,
  });

  const container = document.createElement('div');
  container.id = 'chat-assistant-root';
  document.body.appendChild(container);
  const root = createRoot(container);

  root.render(
    <Suspense fallback={<div>🤖 AI助手加载中...</div>}>
      <App />
    </Suspense>
  );
}