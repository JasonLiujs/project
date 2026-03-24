import React from 'react';
import { Spin, Row, Col, Form } from '@douyinfe/semi-ui';
import { BriefField } from '@lark-project/js-sdk';

interface ColumnPreviewProps {
  spinning: boolean;
  groupFieldList: BriefField[][];
  currentFieldsMap: Map<string, any>;
}

export const ColumnPreview: React.FC<ColumnPreviewProps> = ({
  spinning,
  groupFieldList,
  currentFieldsMap,
}) => {
  const RenderFormItem = (field: BriefField) => {
    const value = currentFieldsMap?.get(field.id);
    return (
      <div className="field-item">
        <span className="field-value">{value || '-'}</span>
      </div>
    );
  };

  const renderFieldList = (list: BriefField[]) =>
    list?.map((item) => (
      <Form.Slot label={item.name} key={item.id}>
        <RenderFormItem {...item} />
      </Form.Slot>
    ));

  return (
    <Spin spinning={spinning}>
      <Form labelPosition="left">
        <Row>
          <Col span={12}>{renderFieldList(groupFieldList[0])}</Col>
          <Col span={10} offset={1}>
            {renderFieldList(groupFieldList[1])}
          </Col>
        </Row>
      </Form>
    </Spin>
  );
};
