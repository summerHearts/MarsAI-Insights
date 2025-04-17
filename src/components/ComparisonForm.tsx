import React, { useState } from 'react';
import { Button, Card, Form, Input, Select, Space, Spin, Tag, Row, Col, Tooltip, Divider, Switch, Collapse, Checkbox, Typography, Badge } from 'antd';
import { SendOutlined, SaveOutlined, CopyOutlined, FileTextOutlined, ClearOutlined, InfoCircleOutlined, StarOutlined, FilterOutlined, SettingOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Model } from '../types';

const { Panel } = Collapse;
const { Text } = Typography;

// 定义预处理选项类型
export interface PreprocessOptions {
  removeTimestamps: boolean;
  removeHtmlTags: boolean;
  normalizeWhitespace: boolean;
  removeDataMarkers: boolean;
  removeSpecialChars: boolean;
  enhanceRoles: boolean;
}

interface ComparisonFormProps {
  models: Model[];
  isLoading: boolean;
  currentPrompt: string;
  currentInput: string;
  onPromptChange: (prompt: string) => void;
  onInputChange: (input: string) => void;
  onCompare: (selectedModelIds: string[], prompt: string, input: string) => void;
  onSaveResult: () => void;
  onSaveInput: () => void;
  enablePreprocess?: boolean;
  onEnablePreprocessChange?: (enable: boolean) => void;
  preprocessOptions?: PreprocessOptions;
  onPreprocessOptionsChange?: (options: PreprocessOptions) => void;
  speakerMap?: Record<string, string>;
  onSpeakerMapChange?: (map: Record<string, string>) => void;
}

const ComparisonForm: React.FC<ComparisonFormProps> = ({
  models,
  isLoading,
  currentPrompt,
  currentInput,
  onPromptChange,
  onInputChange,
  onCompare,
  onSaveResult,
  onSaveInput,
  enablePreprocess = false,
  onEnablePreprocessChange,
  preprocessOptions = {
    removeTimestamps: true,
    removeHtmlTags: true,
    normalizeWhitespace: true,
    removeDataMarkers: true,
    removeSpecialChars: true,
    enhanceRoles: false
  },
  onPreprocessOptionsChange,
  speakerMap = {
    "司机": "司机",
    "用户": "用户"
  },
  onSpeakerMapChange
}) => {
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [showPreprocessOptions, setShowPreprocessOptions] = useState(false);

  const handleSubmit = () => {
    onCompare(selectedModelIds, currentPrompt, currentInput);
  };

  const handleModelsChange = (value: string[]) => {
    setSelectedModelIds(value);
  };

  const handleSelectAll = () => {
    setSelectedModelIds(models.map(model => model.id));
  };

  const handleClearAll = () => {
    setSelectedModelIds([]);
  };

  const handleClearPrompt = () => {
    onPromptChange('');
  };

  const handleClearInput = () => {
    onInputChange('');
  };

  const handlePreprocessChange = (checked: boolean) => {
    if (onEnablePreprocessChange) {
      onEnablePreprocessChange(checked);
    }
    // 当启用预处理时，自动展开高级选项面板
    if (checked && !showPreprocessOptions) {
      setShowPreprocessOptions(true);
    }
  };

  const handlePreprocessOptionChange = (optionName: keyof PreprocessOptions, value: boolean) => {
    if (onPreprocessOptionsChange && preprocessOptions) {
      onPreprocessOptionsChange({
        ...preprocessOptions,
        [optionName]: value
      });
    }
  };

  return (
    <Card 
      title={
        <Space>
          <RocketOutlined style={{ color: '#5B8FF9' }} />
          <span className="card-title">评测配置</span>
        </Space>
      } 
      className="comparison-form-card"
      bordered={false}
      style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)', borderRadius: '12px' }}
    >
      <Form 
        layout="vertical" 
        form={form}
        className="comparison-form"
      >
        <Row gutter={24}>
          <Col xs={24} lg={24}>
            <Form.Item
              label={
                <Space className="form-label">
                  <Badge color="#8B5CF6" />
                  <span>要评测的模型</span>
                  <Tooltip title="选择一个或多个需要比较的模型以进行性能评估">
                    <InfoCircleOutlined style={{ color: '#8B5CF6' }} />
                  </Tooltip>
                  <div style={{ flex: 1 }} />
                  <Button size="small" type="link" onClick={handleSelectAll}>
                    全选
                  </Button>
                  <Button size="small" type="link" onClick={handleClearAll}>
                    清空
                  </Button>
                </Space>
              }
            >
              <Select
                mode="multiple"
                placeholder="请选择要比较的模型"
                value={selectedModelIds}
                onChange={handleModelsChange}
                style={{ width: '100%' }}
                optionFilterProp="label"
                popupMatchSelectWidth={false}
                dropdownStyle={{ padding: '8px', borderRadius: '8px' }}
                options={models
                  .sort((a, b) => {
                    // 免费模型排在前面
                    const aIsFree = a.tags?.includes('免费') || false;
                    const bIsFree = b.tags?.includes('免费') || false;
                    
                    if (aIsFree && !bIsFree) return -1;
                    if (!aIsFree && bIsFree) return 1;
                    
                    // 免费状态相同，按名称排序
                    return a.name.localeCompare(b.name);
                  })
                  .map(model => ({
                    value: model.id,
                    label: model.name + (model.tags?.includes('免费') ? ' [免费]' : ''),
                  }))
                }
                tagRender={props => {
                  const model = models.find(m => m.id === props.value);
                  return (
                    <Tag
                      color={model?.tags?.includes('免费') ? 'success' : 'processing'}
                      closable={props.closable}
                      onClose={props.onClose}
                      style={{ 
                        marginRight: 3, 
                        borderRadius: '4px',
                        padding: '2px 8px'
                      }}
                    >
                      {model?.name || props.value}
                      {model?.tags?.includes('免费') && <StarOutlined style={{ marginLeft: 4, fontSize: '12px' }} />}
                    </Tag>
                  );
                }}
                maxTagCount={5}
                showArrow
                listHeight={300}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} lg={24}>
            <Form.Item 
              label={
                <Space className="form-label">
                  <Badge color="#3B82F6" />
                  <span>提示词</span>
                  <Tooltip title="系统指令，定义模型的行为和任务">
                    <InfoCircleOutlined style={{ color: '#3B82F6' }} />
                  </Tooltip>
                  <div style={{ flex: 1 }} />
                  <Button 
                    type="text" 
                    icon={<ClearOutlined />}
                    size="small"
                    onClick={handleClearPrompt}
                  >
                    清空
                  </Button>
                </Space>
              }
            >
              <Input.TextArea
                value={currentPrompt}
                onChange={e => onPromptChange(e.target.value)}
                placeholder="请输入提示词系统指令，指导模型完成特定任务"
                autoSize={{ minRows: 3, maxRows: 6 }}
                className="prompt-textarea"
                style={{ 
                  borderRadius: '8px', 
                  padding: '12px',
                  fontSize: '14px',
                  backgroundColor: '#f9fafb',
                  transition: 'all 0.3s'
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} lg={24}>
            <Form.Item 
              label={
                <Space className="form-label">
                  <Badge color="#10B981" />
                  <span>输入内容</span>
                  <Tooltip title="用户提供的具体问题或需要处理的内容">
                    <InfoCircleOutlined style={{ color: '#10B981' }} />
                  </Tooltip>
                  <div style={{ flex: 1 }} />
                  <Space>
                    <span className="preprocess-label">文本预处理</span>
                    <Switch 
                      checked={enablePreprocess}
                      onChange={handlePreprocessChange}
                      size="small"
                      className="custom-switch"
                    />
                    <Tooltip title="开启后将对输入文本进行预处理，如清理空格、格式化等">
                      <InfoCircleOutlined style={{ color: '#EC4899' }} />
                    </Tooltip>
                    {enablePreprocess && (
                      <Button 
                        type="text"
                        icon={<SettingOutlined />}
                        size="small"
                        onClick={() => setShowPreprocessOptions(!showPreprocessOptions)}
                      >
                        设置
                      </Button>
                    )}
                  </Space>
                  <Button 
                    type="text" 
                    icon={<ClearOutlined />}
                    size="small"
                    onClick={handleClearInput}
                  >
                    清空
                  </Button>
                </Space>
              }
            >
              <Input.TextArea
                value={currentInput}
                onChange={e => onInputChange(e.target.value)}
                placeholder="请输入需要处理的具体内容、问题或任务"
                autoSize={{ minRows: 5, maxRows: 15 }}
                className="input-textarea"
                style={{ 
                  borderRadius: '8px', 
                  padding: '12px',
                  fontSize: '14px',
                  backgroundColor: '#f9fafb',
                  transition: 'all 0.3s'
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        {enablePreprocess && showPreprocessOptions && (
          <Row gutter={24}>
            <Col span={24}>
              <Card
                size="small"
                className="preprocess-options-card"
                style={{ 
                  marginBottom: 16, 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '8px',
                  boxShadow: 'none',
                  border: '1px solid #e5e7eb'
                }}
              >
                <Row gutter={[16, 8]}>
                  <Col span={8}>
                    <Checkbox
                      checked={preprocessOptions?.removeTimestamps}
                      onChange={e => handlePreprocessOptionChange('removeTimestamps', e.target.checked)}
                    >
                      <Tooltip title="移除文本中的时间戳标记">
                        <Text>移除时间戳</Text>
                      </Tooltip>
                    </Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox
                      checked={preprocessOptions?.removeHtmlTags}
                      onChange={e => handlePreprocessOptionChange('removeHtmlTags', e.target.checked)}
                    >
                      <Tooltip title="移除HTML标签，保留文本内容">
                        <Text>移除HTML标签</Text>
                      </Tooltip>
                    </Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox
                      checked={preprocessOptions?.normalizeWhitespace}
                      onChange={e => handlePreprocessOptionChange('normalizeWhitespace', e.target.checked)}
                    >
                      <Tooltip title="规范化空白字符，如多个空格合并为一个">
                        <Text>规范化空白</Text>
                      </Tooltip>
                    </Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox
                      checked={preprocessOptions?.removeDataMarkers}
                      onChange={e => handlePreprocessOptionChange('removeDataMarkers', e.target.checked)}
                    >
                      <Tooltip title="移除数据标记符号">
                        <Text>移除数据标记</Text>
                      </Tooltip>
                    </Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox
                      checked={preprocessOptions?.removeSpecialChars}
                      onChange={e => handlePreprocessOptionChange('removeSpecialChars', e.target.checked)}
                    >
                      <Tooltip title="移除特殊字符">
                        <Text>移除特殊字符</Text>
                      </Tooltip>
                    </Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox
                      checked={preprocessOptions?.enhanceRoles}
                      onChange={e => handlePreprocessOptionChange('enhanceRoles', e.target.checked)}
                    >
                      <Tooltip title="增强角色标识，使其更容易被模型识别">
                        <Text>增强角色标识</Text>
                      </Tooltip>
                    </Checkbox>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        )}

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleSubmit}
              loading={isLoading}
              block
              style={{ 
                height: '40px', 
                borderRadius: '8px',
                background: 'linear-gradient(90deg, #1890ff 0%, #36cfc9 100%)',
                border: 'none'
              }}
            >
              {isLoading ? '评测中...' : '开始评测'}
            </Button>
          </Col>
          <Col xs={12} sm={6}>
            <Button
              icon={<SaveOutlined />}
              onClick={onSaveInput}
              block
              style={{ height: '40px', borderRadius: '8px' }}
            >
              保存输入
            </Button>
          </Col>
          <Col xs={12} sm={6}>
            <Button
              icon={<SaveOutlined />}
              onClick={onSaveResult}
              disabled={isLoading}
              block
              style={{ height: '40px', borderRadius: '8px' }}
            >
              保存结果
            </Button>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default ComparisonForm; 