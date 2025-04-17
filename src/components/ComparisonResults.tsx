import React, { useState } from 'react';
import { Card, Typography, Badge, Spin, Space, Button, Tooltip, Row, Col, Statistic, Divider, Switch, Tag, Alert } from 'antd';
import { CopyOutlined, CloudDownloadOutlined, DownloadOutlined, LineChartOutlined, BarChartOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ModelResponse } from '../types';

const { Text, Paragraph, Title } = Typography;

interface ComparisonResultsProps {
  isLoading: boolean;
  responses: ModelResponse[];
  prompt: string;
  input: string;
}

const ComparisonResults: React.FC<ComparisonResultsProps> = ({
  isLoading,
  responses,
  prompt,
  input,
}) => {
  // 添加状态来控制是基于UI显示名还是实际模型名分组
  const [useRealModelName, setUseRealModelName] = useState<boolean>(false);
  const [codeBlockView, setCodeBlockView] = useState<boolean>(true);
  // 添加状态控制是否显示系统提示词
  const [showPrompt, setShowPrompt] = useState<boolean>(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadAsJson = (modelResponse: ModelResponse) => {
    const dataStr = JSON.stringify(modelResponse, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `${modelResponse.modelName}_response_${new Date().getTime()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const sortedResponses = [...responses].sort((a, b) => a.responseTime - b.responseTime);

  // 获取每个响应的原始JSON中的模型名称
  const getActualModelName = (response: ModelResponse): string => {
    if (response.rawResponse) {
      // 如果API响应中已经包含了actualModelName字段，直接使用
      if (typeof response.rawResponse === 'object' && response.rawResponse.actualModelName) {
        return response.rawResponse.actualModelName;
      }
      // 否则尝试从model字段获取
      if (typeof response.rawResponse === 'object' && response.rawResponse.model) {
        return response.rawResponse.model;
      }
    }
    return '未知模型';
  };

  // 按模型名称分组
  const modelNameGroups: { [key: string]: ModelResponse[] } = {};
  sortedResponses.forEach(response => {
    // 使用实际模型名或界面显示名
    const groupKey = useRealModelName ? getActualModelName(response) : response.modelName;
    
    if (!modelNameGroups[groupKey]) {
      modelNameGroups[groupKey] = [];
    }
    modelNameGroups[groupKey].push(response);
  });

  // 将分组后的数据转换为列表，每个模型选择最快的那个响应
  const uniqueByModelName = Object.keys(modelNameGroups).map(groupKey => {
    const modelResponses = modelNameGroups[groupKey];
    // 按响应时间排序，选择最快的响应
    modelResponses.sort((a, b) => a.responseTime - b.responseTime);
    return modelResponses[0];
  });

  // 全部响应，未分组
  const allResponses = useRealModelName ? sortedResponses : responses;

  // 检测结果中是否包含代码块
  const containsCodeBlock = (text: string): boolean => {
    return /```[\s\S]*```/.test(text);
  };

  // 提取并格式化代码块
  const formatCodeBlocks = (text: string): React.ReactNode => {
    if (!codeBlockView) {
      // 如果不使用代码块视图，直接显示原始文本
      return <Paragraph>{text}</Paragraph>;
    }

    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    
    let lastIndex = 0;
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // 添加代码块之前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index)
        });
      }
      
      // 添加代码块
      parts.push({
        type: 'code',
        language: match[1] || 'plaintext',
        content: match[2].trim()
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // 添加最后剩余的文本
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }
    
    return (
      <div>
        {parts.map((part, index) => 
          part.type === 'text' ? (
            <Paragraph key={index}>{part.content}</Paragraph>
          ) : (
            <div key={index} className="code-block-container">
              <div className="code-block-header">
                <Text strong style={{ color: '#e6e6e6' }}>{part.language}</Text>
                <Button 
                  type="text" 
                  icon={<CopyOutlined />} 
                  size="small"
                  onClick={() => copyToClipboard(part.content)}
                />
              </div>
              <SyntaxHighlighter
                language={part.language}
                style={vscDarkPlus}
                customStyle={{ margin: 0, borderRadius: '0 0 6px 6px' }}
              >
                {part.content}
              </SyntaxHighlighter>
            </div>
          )
        )}
      </div>
    );
  };

  // 检查是否有任何响应出错
  const hasErrors = responses.some(response => response.error);

  return (
    <Card 
      title={
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>模型输出结果比较</Title>
          {hasErrors && (
            <Tag color="error">部分响应出错</Tag>
          )}
        </Space>
      } 
      loading={isLoading && responses.length === 0}
      className="results-card"
      extra={
        <Space>
          <Space align="center">
            <Text type="secondary">显示系统提示词:</Text>
            <Switch 
              checked={showPrompt} 
              onChange={(checked) => setShowPrompt(checked)}
            />
          </Space>
          <Space align="center">
            <Text type="secondary">使用实际模型名称:</Text>
            <Switch 
              checked={useRealModelName} 
              onChange={(checked) => setUseRealModelName(checked)}
            />
          </Space>
          <Space align="center">
            <Text type="secondary">代码高亮:</Text>
            <Switch 
              checked={codeBlockView} 
              onChange={(checked) => setCodeBlockView(checked)}
              defaultChecked
            />
          </Space>
          <Tooltip title="复制所有结果为JSON">
            <Button 
              icon={<CopyOutlined />} 
              onClick={() => copyToClipboard(JSON.stringify(responses, null, 2))}
            >
              复制JSON
            </Button>
          </Tooltip>
          <Tooltip title="导出完整数据">
            <Button 
              icon={<DownloadOutlined />} 
              type="primary"
              onClick={() => downloadAsJson({
                modelId: 'all',
                modelName: 'All Models',
                responseTime: 0,
                content: '',
                rawResponse: {
                  prompt,
                  input,
                  responses
                }
              })}
            >
              导出数据
            </Button>
          </Tooltip>
        </Space>
      }
    >
      <div style={{ marginBottom: 24 }}>
        {showPrompt && (
          <>
            <Title level={5}>系统提示词</Title>
            <Paragraph>{prompt || '无'}</Paragraph>
          </>
        )}
        
        <Title level={5}>输入内容</Title>
        <Paragraph>
          {responses[0]?.processedInput ? (
            <>
              <Text type="secondary">原始输入：</Text>
              <Paragraph>{input}</Paragraph>
              <Text type="secondary">预处理后：</Text>
              <Paragraph>{responses[0].processedInput}</Paragraph>
            </>
          ) : (
            input
          )}
        </Paragraph>
      </div>

      {isLoading && responses.length > 0 && (
        <Alert
          message="正在加载模型响应"
          description="部分模型响应已加载完成，其他响应正在加载中..."
          type="info"
          showIcon
          icon={<Spin size="small" />}
          style={{ marginBottom: 16 }}
        />
      )}

      {responses.length > 0 ? (
        <>
          <Card 
            title={
              <Space>
                <LineChartOutlined />
                <span>响应时间比较</span>
              </Space>
            }
            className="performance-card"
            size="small"
            style={{ marginBottom: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', padding: '8px 0' }}>
              {sortedResponses.map((response, index) => (
                <div key={`${response.modelName}-${index}`} style={{ 
                  marginRight: 16, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  minWidth: '120px'
                }}>
                  <Badge 
                    count={index + 1} 
                    style={{ 
                      backgroundColor: index === 0 ? '#10B981' : 
                                       index === 1 ? '#3B82F6' : 
                                       index === 2 ? '#8B5CF6' : '#64748B' 
                    }} 
                  />
                  <Text style={{ margin: '8px 0', textAlign: 'center' }}>{response.modelName}</Text>
                  <Statistic 
                    value={response.responseTime / 1000} 
                    precision={2} 
                    suffix="秒"
                    valueStyle={{ 
                      color: index === 0 ? '#10B981' : 
                             index === 1 ? '#3B82F6' : 
                             index === 2 ? '#8B5CF6' : 
                             index === sortedResponses.length - 1 ? '#EF4444' : '#64748B',
                      fontSize: '18px'
                    }}
                  />
                  {index === 0 && <Tag color="success" style={{ marginTop: 4 }}>最快</Tag>}
                </div>
              ))}
            </div>
          </Card>

          <Divider style={{ margin: '0 0 24px 0' }} />

          <Row gutter={[24, 24]}>
            {uniqueByModelName.map((response, index) => (
              <Col xs={24} md={12} key={`${response.modelName}-${index}`}>
                <Card 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Badge 
                        status={response.error ? 'error' : 'success'} 
                        style={{ marginRight: 8 }}
                      />
                      <Space>
                        <Text strong>{response.modelName}</Text>
                        {!response.error && (
                          <Tag 
                            color={index === 0 ? 'success' : 'processing'} 
                            style={{ marginLeft: 8 }}
                          >
                            {(response.responseTime / 1000).toFixed(2)}秒
                          </Tag>
                        )}
                        {useRealModelName ? (
                          <Text type="secondary" style={{ marginLeft: 8 }}>
                            (实际: {getActualModelName(response)})
                          </Text>
                        ) : (
                          <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                            {getActualModelName(response) !== response.modelName ? 
                              `(实际: ${getActualModelName(response)})` : ''}
                          </Text>
                        )}
                      </Space>
                    </div>
                  }
                  className="model-card"
                  extra={
                    <Space>
                      <Tooltip title="复制内容">
                        <Button 
                          type="text" 
                          icon={<CopyOutlined />} 
                          onClick={() => copyToClipboard(response.content)}
                        />
                      </Tooltip>
                      <Tooltip title="下载完整响应">
                        <Button 
                          type="text" 
                          icon={<CloudDownloadOutlined />} 
                          onClick={() => downloadAsJson(response)}
                        />
                      </Tooltip>
                    </Space>
                  }
                >
                  {response.error ? (
                    <Alert
                      message="请求失败"
                      description={response.content || "未能获取模型响应"}
                      type="error"
                      showIcon
                      icon={<CloseCircleOutlined />}
                    />
                  ) : (
                    <div className="response-content">
                      {containsCodeBlock(response.content) ? (
                        formatCodeBlocks(response.content)
                      ) : (
                        <Paragraph>{response.content}</Paragraph>
                      )}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        !isLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Title level={5} type="secondary">暂无模型输出结果</Title>
            <Paragraph type="secondary">选择模型并提供输入后点击"开始评测"按钮</Paragraph>
          </div>
        )
      )}
    </Card>
  );
};

export default ComparisonResults;