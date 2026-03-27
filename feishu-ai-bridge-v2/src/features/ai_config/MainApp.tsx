// 带选项卡功能的主应用组件
import React, { useState } from 'react';
import AIConfig from './App';
import RealChatAssistant from '../chat_assistant/RealChatAssistant';
import { SDKProvider } from '../../hooks/useContext';
import './MainApp.css';

type TabType = 'config' | 'chat';

interface Tab {
  key: TabType;
  title: string;
  icon: string;
  description: string;
}

const tabs: Tab[] = [
  {
    key: 'config',
    title: '流程配置',
    icon: '⚙️',
    description: '配置工作流节点的 gstack 技能'
  },
  {
    key: 'chat',
    title: 'Chat聊天',
    icon: '💬',
    description: '与AI助手进行实时对话'
  }
];

export default function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('config');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'config':
        return <AIConfig />;
      case 'chat':
        return <RealChatAssistant />;
      default:
        return <AIConfig />;
    }
  };

  return (
    <SDKProvider>
      <div className="main-app">
        {/* 选项卡导航栏 */}
        <div className="tab-navigation">
          <div className="tab-nav-header">
          <h1>🤖 AI 工作流助手</h1>
          <p>智能工作流程管理与AI对话助手</p>
        </div>

        <div className="tab-nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab-nav-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <div className="tab-content">
                <span className="tab-title">{tab.title}</span>
                <span className="tab-description">{tab.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

        {/* 选项卡内容区域 */}
        <div className="tab-content-container">
          {renderTabContent()}
        </div>
      </div>
    </SDKProvider>
  );
}