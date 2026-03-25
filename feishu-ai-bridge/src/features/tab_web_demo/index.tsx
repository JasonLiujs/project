import { hot } from 'react-hot-loader/root';
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import './index.less';

const TabWebDemo: React.FC = () => {
  return (
    <div className="tab-container">
      <Typography.Title heading={3}>AI 协同自动化</Typography.Title>
      <div>hello world - Tab Demo</div>
    </div>
  );
};

export default hot(TabWebDemo);
