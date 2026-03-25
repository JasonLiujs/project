import React, { useState, useEffect } from 'react';

function App(): React.ReactElement {
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [workItem, setWorkItem] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const ctx = await window.JSSDK.tab.getContext({});
        setContext(ctx as Record<string, unknown>);

        if (ctx?.workItemId) {
          const item = await window.JSSDK.WorkItem.load({
            workItemId: String(ctx.workItemId),
          });
          setWorkItem(item as Record<string, unknown>);
        }
      } catch (e) {
        console.error('JSSDK load error:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleReadStorage = async () => {
    const value = await window.JSSDK.storage.getItem('test_key');
    alert('storage test_key: ' + value);
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>🤖 AI 协同自动化</h2>
      <p style={{ color: '#666' }}>hello world - JSSDK 已连接</p>

      <div style={{ marginTop: 16 }}>
        <h3>📋 Tab Context</h3>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 200 }}>
          {JSON.stringify(context, null, 2)}
        </pre>
      </div>

      {workItem && (
        <div style={{ marginTop: 16 }}>
          <h3>📦 WorkItem</h3>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 200 }}>
            {JSON.stringify(workItem, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button onClick={handleReadStorage} style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          读取 storage
        </button>
      </div>
    </div>
  );
}

export default App;
