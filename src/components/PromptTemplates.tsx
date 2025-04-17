import React, { useState } from 'react';
import { List, Card, Button, Modal, Form, Input, Popconfirm, message, Space, Typography, Tooltip, Divider } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ExportOutlined, ImportOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  description?: string;
}

interface PromptTemplatesProps {
  templates: PromptTemplate[];
  onTemplatesChange: (templates: PromptTemplate[]) => void;
  onSelect: (template: PromptTemplate) => void;
}

// 默认提示词模板 - 与App.tsx中的DEFAULT_PROMPT_TEMPLATES保持一致
const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: '1',
    title: '通用评估',
    description: '用于评估模型的基础能力',
    prompt: '请根据以下输入，展示你的分析和处理能力。请确保回答准确、完整且有逻辑性。'
  },
  {
    id: '2',
    title: '代码审查',
    description: '用于评估模型的代码理解和优化能力',
    prompt: '请审查以下代码，指出潜在的问题，并提供改进建议。考虑性能、安全性、可维护性等方面。'
  }
];

// 阻止事件冒泡的包装组件
const StopPropagation: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return <div onClick={handleClick}>{children}</div>;
};

const PromptTemplates: React.FC<PromptTemplatesProps> = ({
  templates,
  onTemplatesChange,
  onSelect,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [form] = Form.useForm();

  const showModal = (template?: PromptTemplate) => {
    setEditingTemplate(template || null);
    if (template) {
      form.setFieldsValue(template);
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const newTemplate: PromptTemplate = {
        id: editingTemplate?.id || Date.now().toString(),
        ...values,
      };

      if (editingTemplate) {
        // 更新现有模板
        onTemplatesChange(
          templates.map((t) => (t.id === editingTemplate.id ? newTemplate : t))
        );
        message.success('模板已更新');
      } else {
        // 添加新模板
        onTemplatesChange([...templates, newTemplate]);
        message.success('模板已添加');
      }

      setIsModalVisible(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发卡片的点击事件
    if (e) {
      e.stopPropagation();
    }
    
    onTemplatesChange(templates.filter((t) => t.id !== id));
    message.success('模板已删除');
  };
  
  const handleEdit = (template: PromptTemplate, e: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发卡片的点击事件
    e.stopPropagation();
    showModal(template);
  };

  // 处理卡片点击事件
  const handleCardClick = (template: PromptTemplate) => {
    onSelect(template);
  };

  // 导出提示词模板
  const handleExportTemplates = () => {
    if (templates.length === 0) {
      message.warning('没有可导出的提示词模板');
      return;
    }

    const dataStr = JSON.stringify(templates, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `prompt-templates-export-${new Date().getTime()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    message.success('导出成功');
  };

  // 导入提示词模板
  const handleImportTemplates = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e: any) => {
      if (e.target.files.length) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event: ProgressEvent<FileReader>) => {
          try {
            const importedData = JSON.parse(event.target?.result as string);
            
            if (Array.isArray(importedData) && importedData.every(item => 
              typeof item === 'object' && 
              'title' in item && 
              'prompt' in item
            )) {
              // 给导入的模板添加新的ID以避免冲突
              const importedTemplates = importedData.map(template => ({
                ...template,
                id: Date.now() + '-' + Math.random().toString(36).substring(2, 9)
              }));
              
              onTemplatesChange([...importedTemplates, ...templates]);
              message.success(`成功导入 ${importedTemplates.length} 个提示词模板`);
            } else {
              message.error('导入的数据格式无效，请确保是有效的提示词模板数组');
            }
          } catch (error) {
            console.error('导入数据失败:', error);
            message.error('导入数据失败，请确保是有效的JSON格式');
          }
        };
        
        reader.readAsText(file);
      }
    };
    
    input.click();
  };

  // 重置为默认模板
  const handleResetToDefault = () => {
    setIsResetModalVisible(true);
  };

  const confirmResetToDefault = () => {
    onTemplatesChange(DEFAULT_TEMPLATES);
    message.success('已重置为默认提示词模板');
    setIsResetModalVisible(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          提示词模板管理
          <Text type="secondary" style={{ fontSize: '14px', marginLeft: '10px' }}>
            ({templates.length} 个模板)
          </Text>
          <Tooltip title="点击模板卡片可将提示词加载到评测界面；点击编辑按钮可修改模板；点击删除按钮可删除模板">
            <QuestionCircleOutlined style={{ fontSize: '14px', marginLeft: '8px' }} />
          </Tooltip>
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
          >
            添加提示词模板
          </Button>
          <Button
            icon={<ImportOutlined />}
            onClick={handleImportTemplates}
          >
            导入模板
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExportTemplates}
            disabled={templates.length === 0}
          >
            导出模板
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleResetToDefault}
          >
            重置默认模板
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '0 0 16px 0' }} />

      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', background: '#f9f9f9', borderRadius: '4px' }}>
          <Text type="secondary">暂无提示词模板，请添加或导入模板</Text>
        </div>
      ) : (
        <List
          grid={{ gutter: 16, column: 2 }}
          dataSource={templates}
          renderItem={(template) => (
            <List.Item>
              <Card
                title={template.title}
                extra={
                  <StopPropagation>
                    <Space>
                      <Tooltip title="编辑模板">
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={(e) => handleEdit(template, e)}
                          aria-label="编辑模板"
                        />
                      </Tooltip>
                      <Popconfirm
                        title="确定要删除这个模板吗？"
                        onConfirm={(e) => handleDelete(template.id, e)}
                        okText="确定"
                        cancelText="取消"
                        placement="topRight"
                      >
                        <Tooltip title="删除模板">
                          <Button 
                            type="text" 
                            danger 
                            icon={<DeleteOutlined />}
                            aria-label="删除模板"
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </StopPropagation>
                }
                hoverable
                onClick={() => handleCardClick(template)}
              >
                <div style={{ minHeight: '80px' }}>
                  {template.description ? (
                    <p style={{ marginBottom: '8px' }}>{template.description}</p>
                  ) : (
                    <p style={{ marginBottom: '8px', color: '#999' }}>无描述</p>
                  )}
                  <p style={{ color: '#666', whiteSpace: 'pre-wrap' }}>
                    {template.prompt.length > 100
                      ? `${template.prompt.slice(0, 100)}...`
                      : template.prompt}
                  </p>
                </div>
                <div style={{ textAlign: 'right', marginTop: '8px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>点击卡片加载此模板</Text>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}

      <Modal
        title={editingTemplate ? '编辑提示词模板' : '添加提示词模板'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        okText={editingTemplate ? '保存修改' : '添加'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入模板标题' }]}
          >
            <Input placeholder="请输入模板标题" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入模板描述（可选）" />
          </Form.Item>
          <Form.Item
            name="prompt"
            label="提示词内容"
            rules={[{ required: true, message: '请输入提示词内容' }]}
          >
            <Input.TextArea
              placeholder="请输入提示词内容"
              autoSize={{ minRows: 4, maxRows: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置确认对话框 */}
      <Modal
        title="重置确认"
        open={isResetModalVisible}
        onOk={confirmResetToDefault}
        onCancel={() => setIsResetModalVisible(false)}
        okText="确定重置"
        cancelText="取消"
      >
        <p>确定要重置为默认提示词模板吗？</p>
        <p>这将会<strong>删除所有</strong>现有的自定义模板，并恢复为系统默认模板。</p>
        <p>建议在重置前先导出您的自定义模板。</p>
      </Modal>
    </div>
  );
};

export default PromptTemplates;