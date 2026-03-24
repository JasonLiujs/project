import { useState, useEffect } from 'react';
import RepoConfig from './components/RepoConfig';
import { RepoConfig as RepoConfigType } from './types';

function App() {
  const [config, setConfig] = useState<RepoConfigType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const saved = localStorage.getItem('feishu-ai-bridge-repo-config');
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (newConfig: RepoConfigType) => {
    try {
      const configWithTimestamp = {
        ...newConfig,
        id: newConfig.id || crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('feishu-ai-bridge-repo-config', JSON.stringify(configWithTimestamp));
      setConfig(configWithTimestamp);
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      <div className="navbar bg-base-100 shadow-sm rounded-lg mb-6">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">🚀 AI 协同自动化</a>
        </div>
        <div className="flex-none">
          <div className="text-sm opacity-70">飞书项目集成</div>
        </div>
      </div>
      
      <RepoConfig
        config={config}
        onSave={handleSaveConfig}
      />
    </div>
  );
}

export default App;
