import React, { useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Tabs, Typography, Collapse, message, Switch } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, ExportOutlined, ImportOutlined, CopyOutlined } from '@ant-design/icons';
import { Model } from '../types';

const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Text } = Typography;

interface ModelConfigProps {
  models: Model[];
  onModelsChange: (models: Model[]) => void;
}

const ModelConfig: React.FC<ModelConfigProps> = ({ models, onModelsChange }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [form] = Form.useForm();

  const showAddModal = () => {
    setEditingModel(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (model: Model) => {
    setEditingModel(model);
    form.setFieldsValue(model);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingModel) {
        // 编辑现有模型
        const updatedModels = models.map(m => 
          m.id === editingModel.id ? { ...values, id: editingModel.id } : m
        );
        onModelsChange(updatedModels);
        message.success('模型已更新，配置已自动保存');
      } else {
        // 添加新模型
        const newModel: Model = {
          ...values,
          id: Date.now().toString(),
        };
        onModelsChange([...models, newModel]);
        message.success('模型已添加，配置已自动保存');
      }
      setIsModalVisible(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleDelete = (modelId: string) => {
    const updatedModels = models.filter(m => m.id !== modelId);
    onModelsChange(updatedModels);
    message.success('模型已删除，配置已自动保存');
  };

  const handleReset = () => {
    Modal.confirm({
      title: '重置为默认配置',
      content: '确定要重置为默认模型配置吗？这将覆盖您当前的所有模型设置。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        // 从App.tsx导入DEFAULT_MODELS的值很复杂，我们简单粗暴地添加一些基础模型
        const defaultModels: Model[] = [
          {
            id: '1',
            name: 'qwen2.5-14b-instruct-1m',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
            requestPath: '/v1/chat/completions',
            requestTemplate: '{"model": "qwen2.5-14b-instruct-1m", "messages": [{"role": "system", "content": "{prompt}"}, {"role": "user", "content": "{input}"}]}',
            forceModelName: 'qwen2.5-14b-instruct-1m'
          },
          {
            id: '2',
            name: 'OpenAI GPT-3.5 Turbo',
            baseUrl: 'https://api.openai.com',
            requestPath: '/v1/chat/completions',
            requestTemplate: '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "{prompt}\\n\\n{input}"}]}',
            forceModelName: 'gpt-3.5-turbo'
          },
          {
            id: '3',
            name: '通义千问 Plus',
            baseUrl: 'https://dashscope.aliyuncs.com',
            requestPath: '/compatible-mode/v1/chat/completions',
            requestTemplate: '{"model": "qwen-plus", "messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "{prompt}\\n\\n{input}"}]}',
            forceModelName: 'qwen-plus'
          },
          {
            id: '4',
            name: '通义千问 Turbo',
            baseUrl: 'https://dashscope.aliyuncs.com',
            requestPath: '/compatible-mode/v1/chat/completions',
            requestTemplate: '{"model": "qwen-turbo", "messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "{prompt}\\n\\n{input}"}]}',
            forceModelName: 'qwen-turbo'
          },
          {
            id: '5',
            name: 'qwen2.5-32b-instruct',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
            requestPath: '/v1/chat/completions',
            requestTemplate: '{"model": "qwen2.5-32b-instruct", "messages": [{"role": "system", "content": "{prompt}"}, {"role": "user", "content": "{input}"}]}',
            forceModelName: 'qwen2.5-32b-instruct'
          },
          {
            id: '6',
            name: 'DeepSeek-Coder-V2',
            baseUrl: 'https://api.deepseek.com',
            requestPath: '/v1/chat/completions',
            requestTemplate: '{"model": "deepseek-coder-v2", "messages": [{"role": "system", "content": "{prompt}"}, {"role": "user", "content": "{input}"}]}',
            forceModelName: 'deepseek-coder-v2'
          },
          {
            id: '7',
            name: 'DeepSeek-Chat',
            baseUrl: 'https://api.deepseek.com',
            requestPath: '/v1/chat/completions',
            requestTemplate: '{"model": "deepseek-chat", "messages": [{"role": "system", "content": "{prompt}"}, {"role": "user", "content": "{input}"}]}',
            forceModelName: 'deepseek-chat'
          }
        ];
        
        onModelsChange(defaultModels);
        message.success('已重置为默认模型配置');
        
        // 清除本地存储中的模型配置，让应用在下次启动时重新加载DEFAULT_MODELS
        localStorage.removeItem('model-comparison-models');
      },
    });
  };

  const handleExportModels = () => {
    if (models.length === 0) {
      message.warning('没有可导出的模型配置');
      return;
    }

    const dataStr = JSON.stringify(models, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `model-configs-export-${new Date().getTime()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    message.success('导出成功');
  };

  const handleImportModels = () => {
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
              'id' in item && 
              'name' in item && 
              'baseUrl' in item
            )) {
              // 给导入的模型添加新的ID以避免冲突
              const importedModels = importedData.map(model => ({
                ...model,
                id: Date.now() + '-' + Math.random().toString(36).substring(2, 9)
              }));
              
              onModelsChange([...importedModels, ...models]);
              message.success(`成功导入 ${importedModels.length} 个模型配置`);
            } else {
              message.error('导入的数据格式无效，请确保是有效的模型配置数组');
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

  const handleCopyModel = (model: Model) => {
    // 创建一个新模型对象，基于当前模型但生成新ID和修改名称
    const newModel: Model = {
      ...model,
      id: Date.now().toString(),
      name: `${model.name} (复制)`,
    };
    
    // 添加到现有模型列表中
    onModelsChange([...models, newModel]);
    message.success('模型已复制，配置已自动保存');
  };

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Model) => (
        <Space size="middle">
          <Button 
            icon={<CopyOutlined />} 
            onClick={() => handleCopyModel(record)}
            type="text"
            title="复制模型配置"
          />
          <Button 
            icon={<EditOutlined />} 
            onClick={() => showEditModal(record)}
            type="text"
            title="编辑模型"
          />
          <Popconfirm
            title="确定要删除此模型吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="是"
            cancelText="否"
          >
            <Button 
              icon={<DeleteOutlined />} 
              danger 
              type="text"
              title="删除模型"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        title="模型配置" 
        extra={
          <Space>
            <Button 
              icon={<ImportOutlined />} 
              onClick={handleImportModels}
            >
              导入配置
            </Button>
            <Button 
              icon={<ExportOutlined />} 
              onClick={handleExportModels}
              disabled={models.length === 0}
            >
              导出配置
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleReset}
            >
              重置默认配置
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={showAddModal}
            >
              添加模型
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">所有模型配置将自动保存到浏览器本地存储，应用重启后仍然保留。</Text>
        </div>
        <Table 
          dataSource={models} 
          columns={columns} 
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        title={editingModel ? "编辑模型" : "添加模型"}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={handleCancel}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如: GPT-4, Claude, LLaMA 等" />
          </Form.Item>

          <Form.Item
            name="baseUrl"
            label="基础 URL"
            rules={[{ required: true, message: '请输入基础 URL' }]}
          >
            <Input placeholder="例如: https://api.openai.com" />
          </Form.Item>

          <Form.Item
            name="requestPath"
            label="请求路径"
          >
            <Input placeholder="例如: /v1/chat/completions" />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API 密钥"
          >
            <Input.Password placeholder="API Key (可选)" />
          </Form.Item>

          <Collapse>
            <Panel header="高级设置" key="advanced">
              <Form.Item
                name="forceModelName"
                label="强制模型名称"
                tooltip="指定实际API请求时使用的模型名称，可用于确保不同UI配置实际请求不同的模型"
              >
                <Input placeholder="例如: gpt-4, qwen-7b, glm-4 等..." />
              </Form.Item>
              
              <Form.Item
                name="requestTemplate"
                label="请求模板 (JSON 格式)"
              >
                <Input.TextArea 
                  rows={5}
                  placeholder='{"model": "gpt-4", "messages": [{"role": "user", "content": "{prompt}\n\n{input}"}]}'
                />
              </Form.Item>

              <Form.Item
                name="headers"
                label="自定义请求头 (JSON 格式)"
              >
                <Input.TextArea 
                  rows={3}
                  placeholder='{"Content-Type": "application/json", "Custom-Header": "value"}'
                />
              </Form.Item>

              <Form.Item
                name="supportsStreaming"
                label="启用流式输出"
                tooltip="开启后将使用流式输出模式，适用于Qwen-QWQ等仅支持流式输出的模型"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Text type="secondary">
                注意: 在请求模板中，使用 {'{prompt}'} 和 {'{input}'} 作为占位符，它们将被实际值替换。
              </Text>
            </Panel>
          </Collapse>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelConfig; 