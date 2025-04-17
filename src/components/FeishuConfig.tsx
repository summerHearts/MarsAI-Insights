import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Switch, 
  message, 
  Typography, 
  Space, 
  Divider,
  Alert
} from 'antd';
import { 
  SendOutlined, 
  SettingOutlined, 
  QuestionCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { FeishuConfig, testFeishuConfig } from '../services/feishuService';

const { Text, Title, Paragraph, Link } = Typography;

interface FeishuConfigProps {
  config: FeishuConfig;
  onChange: (config: FeishuConfig) => void;
  standalone?: boolean; // 是否作为独立页面使用
}

const FeishuConfigComponent: React.FC<FeishuConfigProps> = ({ config, onChange, standalone = false }) => {
  const [form] = Form.useForm();
  const [isTesting, setIsTesting] = useState(false);
  const [localConfig, setLocalConfig] = useState<FeishuConfig>(config);

  useEffect(() => {
    form.setFieldsValue({
      enabled: config.enabled,
      webhook: config.webhook || '',
      secret: config.secret || '',
    });
    setLocalConfig(config);
  }, [config, form]);

  const handleValuesChange = (changedValues: any) => {
    const newConfig = { ...localConfig, ...changedValues };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      const testResult = await testFeishuConfig(localConfig);
      
      if (testResult.success) {
        message.success(testResult.message);
      } else {
        message.error(testResult.message);
      }
    } catch (error) {
      message.error('测试飞书配置时出错');
      console.error('测试飞书配置时出错:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const content = (
    <>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enabled: config.enabled,
          webhook: config.webhook || '',
          secret: config.secret || '',
        }}
        onValuesChange={handleValuesChange}
      >
        <Form.Item
          name="enabled"
          label="启用飞书通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="已启用" unCheckedChildren="已禁用" />
        </Form.Item>

        <Form.Item
          name="webhook"
          label="飞书 Webhook 地址"
          rules={[
            { required: localConfig.enabled, message: '请输入飞书 Webhook 地址' },
            { type: 'url', message: '请输入有效的 URL 地址' }
          ]}
        >
          <Input
            placeholder="请输入飞书机器人 Webhook 地址"
            disabled={!localConfig.enabled}
          />
        </Form.Item>

        <Form.Item
          name="secret"
          label="加签密钥（可选）"
          tooltip={{
            title: '如果飞书机器人开启了签名校验，需要填写此密钥',
            icon: <QuestionCircleOutlined />
          }}
        >
          <Input.Password
            placeholder="飞书机器人加签密钥（如已开启签名校验）"
            disabled={!localConfig.enabled}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleTest}
            loading={isTesting}
            disabled={!localConfig.enabled || !localConfig.webhook}
          >
            测试发送消息
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      <Title level={5}>飞书通知说明</Title>
      <Paragraph>
        <ul>
          <li>启用飞书通知后，批处理或评测任务完成时会自动发送通知到飞书</li>
          <li>您需要在飞书中创建一个机器人并获取 Webhook 地址</li>
          <li>如果开启了签名校验，还需要填写签名密钥</li>
        </ul>
      </Paragraph>
      
      <Alert
        message="如何创建飞书机器人"
        description={
          <Text>
            1. 在飞书群中点击【群设置】-【群机器人】-【添加机器人】<br/>
            2. 选择【自定义机器人】，点击添加<br/>
            3. 配置机器人名称，头像等信息<br/>
            4. 复制生成的 Webhook 地址，填入上方表单中<br/>
            5. 如果开启了签名校验，还需复制签名密钥
          </Text>
        }
        type="info"
        showIcon
      />
    </>
  );

  // 如果是独立页面，使用Card包装
  if (standalone) {
    return (
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>系统通知配置</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {content}
      </Card>
    );
  }

  // 作为子组件在其他页面使用
  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>飞书通知配置</span>
        </Space>
      }
      bordered={false}
    >
      {content}
    </Card>
  );
};

export default FeishuConfigComponent; 