import React, { useState } from 'react';
import { Card, Typography, Badge, Spin, Space, Button, Tooltip, Row, Col, Statistic, Divider, Switch, Tag, Alert, Empty } from 'antd';
import { CopyOutlined, CloudDownloadOutlined, DownloadOutlined, LineChartOutlined, BarChartOutlined, CheckCircleOutlined, CloseCircleOutlined, CodeOutlined, ReadOutlined, RocketOutlined } from '@ant-design/icons';
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
            <Paragraph key={index} className="result-text-content">{part.content}</Paragraph>
          ) : (
            <div key={index} className="code-block-container">
              <div className="code-block-header">
                <Space>
                  <CodeOutlined style={{ color: '#e6e6e6' }} />
                  <Text strong style={{ color: '#e6e6e6' }}>{part.language}</Text>
                </Space>
                <Button 
                  type="text" 
                  icon={<CopyOutlined />} 
                  size="small"
                  onClick={() => copyToClipboard(part.content)}
                  className="code-copy-btn"
                />
              </div>
              <SyntaxHighlighter
                language={part.language}
                style={vscDarkPlus}
                customStyle={{ 
                  margin: 0, 
                  borderRadius: '0 0 8px 8px',
                  fontSize: '14px'
                }}
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
          <RocketOutlined style={{ color: '#10B981', fontSize: '18px' }} />
          <Title level={4} style={{ margin: 0 }}>模型输出结果</Title>
          {hasErrors && (
            <Tag color="error">部分响应出错</Tag>
          )}
        </Space>
      } 
      loading={isLoading && responses.length === 0}
      className="results-card"
      bordered={false}
      style={{ 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
      }}
      extra={
        <Space>
          <Space align="center" className="view-option">
            <Text type="secondary">系统提示词:</Text>
            <Switch 
              checked={showPrompt} 
              onChange={(checked) => setShowPrompt(checked)}
              size="small"
            />
          </Space>
          <Space align="center" className="view-option">
            <Text type="secondary">代码高亮:</Text>
            <Switch 
              checked={codeBlockView} 
              onChange={(checked) => setCodeBlockView(checked)}
              defaultChecked
              size="small"
            />
          </Space>
          <Tooltip title="复制所有结果为JSON">
            <Button 
              icon={<CopyOutlined />} 
              onClick={() => copyToClipboard(JSON.stringify(responses, null, 2))}
            />
          </Tooltip>
        </Space>
      }
    >
      {isLoading && (
        <div className="loading-container">
          <Spin size="large" tip="正在等待模型响应..." />
        </div>
      )}

      {!isLoading && responses.length === 0 && (
        <Empty 
          description="暂无模型输出结果"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '40px 0' }}
        />
      )}

      {showPrompt && prompt && !isLoading && (
        <Alert
          type="info"
          message="系统提示词"
          description={
            <div className="prompt-container">
              <pre>{prompt}</pre>
              <Button 
                icon={<CopyOutlined />}
                type="text"
                size="small"
                onClick={() => copyToClipboard(prompt)}
                className="copy-btn"
              />
            </div>
          }
          style={{ marginBottom: 24, borderRadius: '8px' }}
        />
      )}

      <Row gutter={[16, 16]}>
        {!isLoading && (useRealModelName ? uniqueByModelName : responses).map((response, index) => (
          <Col key={index} xs={24} lg={24}>
            <Card
              className="model-response-card"
              style={{ 
                borderRadius: '8px',
                border: '1px solid #f0f0f0',
                overflow: 'hidden'
              }}
              title={
                <Space>
                  <Tag 
                    color={response.error ? 'error' : 'processing'} 
                    style={{ 
                      borderRadius: '12px', 
                      padding: '0 12px',
                      marginRight: '8px'
                    }}
                  >
                    {useRealModelName ? getActualModelName(response) : response.modelName}
                  </Tag>
                  <Badge 
                    status={response.error ? 'error' : 'success'} 
                    text={response.error ? '调用失败' : '成功'} 
                  />
                  <Divider type="vertical" />
                  <Text type="secondary">响应时间: {(response.responseTime / 1000).toFixed(2)}秒</Text>
                </Space>
              }
              extra={
                <Space>
                  <Tooltip title="复制内容">
                    <Button 
                      icon={<CopyOutlined />}
                      type="text"
                      onClick={() => copyToClipboard(response.content)}
                    />
                  </Tooltip>
                  <Tooltip title="下载为JSON">
                    <Button 
                      icon={<DownloadOutlined />}
                      type="text"
                      onClick={() => downloadAsJson(response)}
                    />
                  </Tooltip>
                </Space>
              }
              bodyStyle={{ 
                padding: response.error ? '16px' : '0',
                backgroundColor: response.error ? '#fff2f0' : 'transparent'
              }}
            >
              {response.error ? (
                <Alert
                  message="错误"
                  description={response.error}
                  type="error"
                  showIcon
                />
              ) : (
                <div className="response-content">
                  {containsCodeBlock(response.content) ? 
                    formatCodeBlocks(response.content) : 
                    <div className="plain-text-content">{response.content}</div>
                  }
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default ComparisonResults;