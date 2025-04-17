import React, { useState } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  Input, 
  Space, 
  message, 
  Typography, 
  Select,
  Spin,
  Divider,
  Tag,
  Alert
} from 'antd';
import { 
  UploadOutlined, 
  SendOutlined, 
  PictureOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { Model } from '../types';
import { callModelWithImage } from '../services/api';
import type { UploadFile, RcFile } from 'antd/lib/upload/interface';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface ImageAnalyzerProps {
  models: Model[];
}

const IMAGE_PROMPTS = [
  { label: '描述这张图片', value: '请详细描述这张图片中的内容' },
  { label: '分析图片中的文本', value: '请识别并提取图片中的所有文本内容' },
  { label: '识别对象', value: '请识别图片中的主要对象，并告诉我它们的位置和特征' },
  { label: '分析情感', value: '请分析这张图片中体现的情感氛围' },
  { label: '回答图片问题', value: '根据这张图片，' },
];

const ImageAnalyzer: React.FC<ImageAnalyzerProps> = ({ models }) => {
  const [image, setImage] = useState<UploadFile | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('请详细描述这张图片中的内容');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  // 获取并排序支持视觉的模型
  const visualModels = models.filter(model => 
    // 优先检查标签
    (model.tags?.includes('图像分析')) ||
    // 检查模型名称是否包含视觉模型相关关键词
    model.forceModelName?.toLowerCase().includes('vl') || 
    model.forceModelName?.toLowerCase().includes('vision') ||
    model.name.toLowerCase().includes('vl') ||
    model.name.toLowerCase().includes('vision') ||
    // 检查是否为OpenRouter上的Qwen-VL模型
    (model.baseUrl?.includes('openrouter.ai') && 
     model.forceModelName?.toLowerCase().includes('qwen') &&
     model.forceModelName?.toLowerCase().includes('vl'))
  ).sort((a, b) => {
    // 免费模型排在前面
    const aIsFree = a.tags?.includes('免费') || false;
    const bIsFree = b.tags?.includes('免费') || false;
    
    if (aIsFree && !bIsFree) return -1;
    if (!aIsFree && bIsFree) return 1;
    
    // 免费状态相同，按名称排序
    return a.name.localeCompare(b.name);
  });

  // 处理图片上传
  const handleImageUpload = async (file: RcFile) => {
    try {
      // 设置预览
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setImage(file as UploadFile);
      
      // 转换为Base64
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const base64String = (e.target.result as string).split(',')[1];
          setImageBase64(base64String);
        }
      };
      reader.readAsDataURL(file);
      
      return false; // 阻止默认上传行为
    } catch (error) {
      console.error('处理图片上传失败:', error);
      message.error('图片上传失败');
      return false;
    }
  };

  // 处理提示词下拉选择
  const handlePromptSelect = (value: string) => {
    setPrompt(value);
  };

  // 清除图片
  const handleClearImage = () => {
    setImage(null);
    setImageBase64('');
    setImagePreview('');
  };

  // 分析图片
  const handleAnalyzeImage = async () => {
    if (!imageBase64) {
      message.warning('请先上传图片');
      return;
    }

    if (!prompt.trim()) {
      message.warning('请输入提示词');
      return;
    }

    if (!selectedModelId) {
      message.warning('请选择一个模型');
      return;
    }

    const selectedModel = models.find(m => m.id === selectedModelId);
    
    if (!selectedModel) {
      message.error('所选模型不存在');
      return;
    }

    // 检查所选模型是否为VL模型
    const isVLModel = 
      selectedModel.tags?.includes('图像分析') ||
      selectedModel.forceModelName?.toLowerCase().includes('vl') ||
      selectedModel.forceModelName?.toLowerCase().includes('vision') ||
      selectedModel.name.toLowerCase().includes('vl') ||
      selectedModel.name.toLowerCase().includes('vision');

    if (!isVLModel) {
      message.error('请选择支持图像分析的视觉语言(VL)模型');
      return;
    }

    setIsLoading(true);
    setResult('');
    setError('');

    try {
      const response = await callModelWithImage(
        selectedModel,
        prompt,
        imageBase64,
        { temperature: 0.3 }
      );

      if (response.error) {
        setError(response.error);
      } else {
        setResult(response.content);
      }
    } catch (err: any) {
      console.error('图像分析错误:', err);
      setError(err.message || '分析图像时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card title="图像分析" extra={<PictureOutlined />}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={5}>第一步：上传图片</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <Upload
              beforeUpload={handleImageUpload}
              maxCount={1}
              showUploadList={false}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />}>选择图片</Button>
            </Upload>
            
            {image && (
              <Space>
                <Text type="secondary">{image.name}</Text>
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={handleClearImage}
                />
              </Space>
            )}
          </div>
          
          {imagePreview && (
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              <img 
                src={imagePreview} 
                alt="预览" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '300px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  padding: '4px'
                }} 
              />
            </div>
          )}
        </div>
        
        <div>
          <Title level={5}>第二步：选择模型</Title>
          <Alert
            message="图像分析仅支持视觉语言(VL)模型"
            description="请选择带有'图像分析'标签的模型，或名称/ID中包含'vl'或'vision'的模型"
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
          <Select
            placeholder="请选择支持图像处理的模型"
            style={{ width: '100%' }}
            value={selectedModelId}
            onChange={(value) => setSelectedModelId(value)}
            optionLabelProp="label"
          >
            {visualModels.map(model => (
              <Option key={model.id} value={model.id} label={model.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {model.name}
                    {(model.forceModelName?.toLowerCase().includes('vl') || 
                      model.name.toLowerCase().includes('vl') ||
                      model.tags?.includes('图像分析')) && 
                      <Tag color="purple" style={{ marginLeft: 4 }}>VL</Tag>
                    }
                  </span>
                  <span>
                    {model.tags?.map(tag => {
                      let color = 'default';
                      if (tag === '免费') color = 'green';
                      if (tag === '收费') color = 'red';
                      if (tag === 'VPN') color = 'blue';
                      if (tag === '国内可用') color = 'gold';
                      if (tag === '图像分析') color = 'purple';
                      if (tag === '思考型模型') color = 'geekblue';
                      if (tag === 'Chat模型') color = 'cyan';
                      return <Tag color={color} key={tag} style={{ marginRight: 4 }}>{tag}</Tag>;
                    })}
                  </span>
                </div>
              </Option>
            ))}
          </Select>
          {visualModels.length === 0 && (
            <Text type="warning" style={{ display: 'block', marginTop: '8px' }}>
              没有找到支持图像分析的视觉模型(VL)，请在模型配置中添加带有"图像分析"标签的模型，如Qwen2.5-VL等视觉模型
            </Text>
          )}
        </div>
        
        <div>
          <Title level={5}>第三步：输入提示词</Title>
          <div style={{ marginBottom: '16px' }}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择预设提示词"
              onChange={handlePromptSelect}
              value={prompt}
            >
              {IMAGE_PROMPTS.map(item => (
                <Option key={item.value} value={item.value}>{item.label}</Option>
              ))}
            </Select>
          </div>
          <TextArea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入提示词，告诉模型如何分析图片"
          />
        </div>
        
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleAnalyzeImage}
          disabled={!imageBase64 || !prompt.trim() || !selectedModelId || isLoading}
          loading={isLoading}
          block
        >
          分析图片
        </Button>
        
        <Divider />
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="正在分析图片，请稍候..." />
          </div>
        ) : error ? (
          <div style={{ padding: '16px', border: '1px solid #ffccc7', borderRadius: '4px', backgroundColor: '#fff2f0' }}>
            <Title level={5} type="danger">分析错误</Title>
            <Paragraph>{error}</Paragraph>
          </div>
        ) : result ? (
          <div style={{ padding: '16px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
            <Title level={5}>分析结果</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{result}</Paragraph>
          </div>
        ) : null}
      </Space>
    </Card>
  );
};

export default ImageAnalyzer; 