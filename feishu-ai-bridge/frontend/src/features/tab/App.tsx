import React, { useEffect, useState } from 'react';
import { Select, Spin } from '@douyinfe/semi-ui';
import { ColumnPreview } from './components/ColumnPreview';
import './index.css';

const optionList = [
  { label: '文本字段', value: 'text' },
  { label: '数字字段', value: 'number' },
  { label: '日期字段', value: 'date' },
  { label: '用户字段', value: 'user' },
];

interface BriefField {
  id: string;
  name: string;
  type: string;
}

const App: React.FC = () => {
  const [selectFieldType, setSelectFieldType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [groupFieldList, setGroupFieldList] = useState<BriefField[][]>([[], []]);
  const [currentFieldsMap, setCurrentFieldsMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    initPlugin();
  }, []);

  const initPlugin = async () => {
    setLoading(true);
    try {
      const ctx = await window.JSSDK.tab.getContext();
      console.log('工作项上下文:', ctx);
    } catch (error) {
      console.error('获取上下文失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldTypeChange = async (value: string) => {
    setSelectFieldType(value);
    setLoading(true);
    try {
      // 根据选择的字段类型加载字段列表
      // 示例数据，实际应调用 JSSDK 获取
      setGroupFieldList([
        [
          { id: 'field_1', name: '字段1', type: value },
          { id: 'field_2', name: '字段2', type: value },
        ],
        [
          { id: 'field_3', name: '字段3', type: value },
          { id: 'field_4', name: '字段4', type: value },
        ],
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrapper">
      <div className="navbar bg-base-100 shadow-sm rounded-lg mb-6">
        <div className="flex-1">
          <span className="text-xl">AI 协同自动化</span>
        </div>
        <div className="flex-none">
          <span className="text-sm opacity-70">飞书项目集成</span>
        </div>
      </div>

      <div className="mb-4">
        <Select
          optionList={optionList}
          style={{ width: 320 }}
          placeholder="请选择字段类型"
          value={selectFieldType}
          onChange={(value) => handleFieldTypeChange(value as string)}
        />
      </div>

      <ColumnPreview
        spinning={loading}
        groupFieldList={groupFieldList}
        currentFieldsMap={currentFieldsMap}
      />
    </div>
  );
};

export default App;
