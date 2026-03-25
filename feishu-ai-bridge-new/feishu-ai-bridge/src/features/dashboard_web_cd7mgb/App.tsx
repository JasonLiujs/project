
import React from 'react';
import './index.css';

const App: React.FC = () => {
  const openUrl = (url: string) => {
    window.JSSDK.navigation.open(url);
  };

  return (
    <div className="wrapper">
      <h1 className="title">
        123
      </h1>
      <p className="desc">
        <span className="desc-text">
          <span>🛠️</span>
          Get started by editing
        </span>
        <pre className="desc-entry">
          ./src/features/dashboard_web_cd7mgb/index.tsx
        </pre>
      </p>
      <div className="btn-group">
        <a
          onClick={() => openUrl("https://project.feishu.cn/openapp/start_guide")}
          className="primary"
        >
          <svg className="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" focusable="false"><path d="M2.66675 11.3333L6.66675 7.33325L2.66675 3.33325M8.00008 12.6666H13.3334" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          <span>
            Get Started
          </span>
        </a>
        <a
          onClick={() => openUrl("https://project.feishu.cn/b/helpcenter/1p8d7djs/x4l57qtx")}
          className="secondary"
        >
          <svg className="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" focusable="false"><path d="M2.66675 11.3333L6.66675 7.33325L2.66675 3.33325M8.00008 12.6666H13.3334" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          <span>
            Client API
          </span>
        </a>
        <a
          onClick={() => openUrl("https://project.feishu.cn/b/helpcenter/1p8d7djs/aa6btca8")}
          className="secondary"
        >
          <svg className="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" focusable="false"><path d="M2.66675 11.3333L6.66675 7.33325L2.66675 3.33325M8.00008 12.6666H13.3334" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          <span>
            Client Component
          </span>
        </a>
       </div>
    </div>
  );
}

export default App;
