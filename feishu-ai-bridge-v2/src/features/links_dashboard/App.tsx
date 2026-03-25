import React, { useState, useEffect } from 'react';
import { useWorkItemContext } from '../../hooks/useContext';
import { mcpClient } from '../../api/mcp';
import './LinksDashboard.css';

interface LinkField {
  key: string;
  value: string;
}

export default function LinksDashboard() {
  const { workItemId, workItemType, loading: ctxLoading } = useWorkItemContext();
  const [links, setLinks] = useState<LinkField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workItemId || !workItemType || ctxLoading) return;

    const fetchLinks = async () => {
      setLoading(true);
      try {
        const result = await mcpClient.getWorkItemBrief(workItemId, workItemType);
        const data = result?.data;
        if (data) {
          const linkFields: LinkField[] = Object.entries(data)
            .filter(([, value]) => typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://')))
            .map(([key, value]) => ({ key, value: value as string }));
          setLinks(linkFields);
        } else {
          setLinks(getMockLinks());
        }
      } catch {
        setLinks(getMockLinks());
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
  }, [workItemId, workItemType, ctxLoading]);

  const getMockLinks = (): LinkField[] => [
    { key: '需求文档', value: 'https://bytedance.feishu.cn/wiki/wikcnXXX' },
    { key: '设计稿', value: 'https://www.figma.com/file/xxx' },
    { key: '相关视频', value: 'https://www.bilibili.com/video/xxx' },
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // silent success
    });
  };

  if (ctxLoading || loading) {
    return (
      <div className="links-loading">
        <div className="loading-spinner" />
        <span>加载链接数据...</span>
      </div>
    );
  }

  return (
    <div className="links-dashboard">
      <div className="links-header">
        <h2>🔗 链接汇总</h2>
        <span className="links-count">{links.length} 个链接</span>
      </div>

      {error && (
        <div className="links-error">⚠️ {error}</div>
      )}

      {links.length === 0 ? (
        <div className="links-empty">
          <span>📭</span>
          <p>暂无链接数据</p>
        </div>
      ) : (
        <div className="links-list">
          {links.map((link, idx) => (
            <div key={idx} className="link-item">
              <div className="link-label">{link.key}</div>
              <div className="link-value-row">
                <a
                  className="link-url"
                  href={link.value}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.value}
                </a>
                <button
                  className="btn-copy"
                  onClick={() => handleCopy(link.value)}
                  title="复制链接"
                >
                  📋
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
