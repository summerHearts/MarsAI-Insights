import React, { useState } from 'react';
import { Button, Card, Form, Input, Select, Space, Spin, Tag, Row, Col, Tooltip, Divider, Switch, Collapse, Checkbox, Typography } from 'antd';
import { SendOutlined, SaveOutlined, CopyOutlined, FileTextOutlined, ClearOutlined, InfoCircleOutlined, StarOutlined, FilterOutlined, SettingOutlined } from '@ant-design/icons';
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
          <FileTextOutlined />
          <span>评测配置</span>
        </Space>
      } 
      className="comparison-form-card"
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
                <Space>
                  <span>选择要评测的模型</span>
                  <Tooltip title="请选择一个或多个需要比较的模型">
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
                      color={model?.tags?.includes('免费') ? 'green' : 'blue'}
                      closable={props.closable}
                      onClose={props.onClose}
                      style={{ marginRight: 3 }}
                    >
                      {model?.name || props.value}
                      {model?.tags?.includes('免费') && <span style={{ marginLeft: 4 }}>⭐</span>}
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
                <Space>
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
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} lg={24}>
            <Form.Item 
              label={
                <Space>
                  <span>输入内容</span>
                  <Tooltip title="用户提供的具体问题或需要处理的内容">
                    <InfoCircleOutlined style={{ color: '#10B981' }} />
                  </Tooltip>
                  <div style={{ flex: 1 }} />
                  <Space>
                    <span>启用文本预处理</span>
                    <Switch 
                      checked={enablePreprocess}
                      onChange={handlePreprocessChange}
                      size="small"
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
              {enablePreprocess && showPreprocessOptions && (
                <div style={{ marginBottom: 16, background: '#f9f9f9', padding: 12, borderRadius: 6 }}>
                  <Collapse bordered={false} defaultActiveKey={['1']}>
                    <Panel 
                      header={
                        <span>
                          <FilterOutlined style={{ marginRight: 8 }} />
                          文本预处理选项
                        </span>
                      } 
                      key="1"
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Checkbox 
                          checked={preprocessOptions.removeTimestamps}
                          onChange={e => handlePreprocessOptionChange('removeTimestamps', e.target.checked)}
                        >
                          <Space>
                            <span>去除时间戳</span>
                            <Text type="secondary">[00::00::00-00::00::00]</Text>
                          </Space>
                        </Checkbox>
                        
                        <Checkbox 
                          checked={preprocessOptions.removeHtmlTags}
                          onChange={e => handlePreprocessOptionChange('removeHtmlTags', e.target.checked)}
                        >
                          <Space>
                            <span>去除HTML标签</span>
                            <Text type="secondary">&lt;tag&gt;内容&lt;/tag&gt;</Text>
                          </Space>
                        </Checkbox>
                        
                        <Checkbox 
                          checked={preprocessOptions.normalizeWhitespace}
                          onChange={e => handlePreprocessOptionChange('normalizeWhitespace', e.target.checked)}
                        >
                          <Space>
                            <span>规范化空白字符</span>
                            <Text type="secondary">清理多余空格和换行</Text>
                          </Space>
                        </Checkbox>
                        
                        <Checkbox 
                          checked={preprocessOptions.removeDataMarkers}
                          onChange={e => handlePreprocessOptionChange('removeDataMarkers', e.target.checked)}
                        >
                          <Space>
                            <span>去除数据标记</span>
                            <Text type="secondary">[DATA], &lt;DATA&gt;, [123]</Text>
                          </Space>
                        </Checkbox>
                        
                        <Checkbox 
                          checked={preprocessOptions.removeSpecialChars}
                          onChange={e => handlePreprocessOptionChange('removeSpecialChars', e.target.checked)}
                        >
                          <Space>
                            <span>去除特殊字符</span>
                            <Text type="secondary">控制字符和不可见字符</Text>
                          </Space>
                        </Checkbox>
                        
                        <Checkbox 
                          checked={preprocessOptions.enhanceRoles}
                          onChange={e => handlePreprocessOptionChange('enhanceRoles', e.target.checked)}
                        >
                          <Space>
                            <span>角色增强</span>
                            <Text type="secondary">将对话转换为结构化JSON数据</Text>
                          </Space>
                        </Checkbox>
                        
                        {preprocessOptions.enhanceRoles && (
                          <div style={{ marginTop: '16px', borderTop: '1px dashed #d9d9d9', paddingTop: '16px' }}>
                            <Text strong>角色映射配置：</Text>
                            <div style={{ marginTop: '8px' }}>
                              <Input.TextArea
                                value={JSON.stringify(speakerMap, null, 2)}
                                onChange={e => {
                                  try {
                                    const newMap = JSON.parse(e.target.value);
                                    if (typeof newMap === 'object' && newMap !== null && !Array.isArray(newMap)) {
                                      onSpeakerMapChange && onSpeakerMapChange(newMap);
                                    }
                                  } catch (error) {
                                    // 解析错误，不更新状态
                                    console.error('角色映射配置格式错误:', error);
                                  }
                                }}
                                placeholder='{"司机": "司机", "用户": "用户"}'
                                autoSize={{ minRows: 4, maxRows: 8 }}
                                style={{ fontFamily: 'monospace' }}
                              />
                              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                                JSON格式，用于将原文中的角色名映射为标准角色名
                              </Text>
                              
                              <div style={{ marginTop: '8px' }}>
                                <Button 
                                  size="small" 
                                  type="link" 
                                  onClick={() => {
                                    const testText = `司机[0::0::0-0::9::310]:喂，你重新换个车啊，这个单子我我他你帮我排3点几公里帮我排个单子嘞。
司机[0::9::310-0::14::220]:好，好晕了。`;
                                    onInputChange(testText);
                                  }}
                                >
                                  插入测试对话
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Panel>
                  </Collapse>
                </div>
              )}
              
              <Input.TextArea
                value={currentInput}
                onChange={e => onInputChange(e.target.value)}
                placeholder="请输入需要模型处理的具体内容、问题或任务"
                autoSize={{ minRows: 4, maxRows: 10 }}
                className="input-textarea"
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0 24px' }} />

        <Form.Item style={{ marginBottom: 0 }}>
          <Space size="middle" wrap>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={isLoading}
              disabled={!currentInput || selectedModelIds.length === 0}
              size="large"
            >
              开始评测
            </Button>
            <Tooltip title="保存当前评测结果，可在历史记录中查看">
              <Button
                icon={<SaveOutlined />}
                onClick={onSaveResult}
                disabled={isLoading || (models.length === 0)}
                size="large"
              >
                保存结果
              </Button>
            </Tooltip>
            <Tooltip title="保存当前输入和提示词，可在历史记录中查看">
              <Button
                icon={<StarOutlined />}
                onClick={onSaveInput}
                disabled={!currentInput && !currentPrompt}
                size="large"
              >
                保存输入
              </Button>
            </Tooltip>
            <Tooltip title="复制当前配置为JSON格式">
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  const values = {
                    prompt: currentPrompt,
                    input: currentInput,
                    models: selectedModelIds.map(id => models.find(m => m.id === id)?.name || id)
                  };
                  navigator.clipboard.writeText(JSON.stringify(values, null, 2));
                }}
                size="large"
              >
                复制配置
              </Button>
            </Tooltip>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ComparisonForm; 