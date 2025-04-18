import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Typography, Modal, Input, message, theme, Button, Dropdown, Space, Avatar, Tooltip, Upload, Switch, Collapse, Checkbox } from 'antd';
import { 
  SyncOutlined, 
  SettingOutlined, 
  HistoryOutlined,
  FileTextOutlined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SaveOutlined,
  FileExcelOutlined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  AppstoreOutlined,
  ToolOutlined,
  DashboardOutlined,
  TeamOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TableOutlined,
  AuditOutlined,
  BarChartOutlined,
  SendOutlined,
  CameraOutlined
} from '@ant-design/icons';
import ModelConfig from './components/ModelConfig';
import ComparisonForm from './components/ComparisonForm';
import ComparisonResults from './components/ComparisonResults';
import SavedComparisons from './components/SavedComparisons';
import PromptTemplates, { PromptTemplate } from './components/PromptTemplates';
import BatchProcessing from './components/BatchProcessing';
import ExcelProcessor from './components/ExcelProcessor';
import JudgmentAnalyzer from './components/JudgmentAnalyzer';
import ChartAnalyzer from './components/ChartAnalyzer';
import ImageAnalyzer from './components/ImageAnalyzer';
import { callModel } from './services/api';
import { Model, ModelResponse, SavedComparison, SavedInput, BatchJob, ExcelItem, PreprocessOptions, SpeakerMap } from './types';
import { 
  enhanceRoles, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  processConversation
} from './utils/textProcessors';
import './App.css';
import { FeishuConfig } from './services/feishuService';
import FeishuConfigComponent from './components/FeishuConfig';
import ChatAssistant from './components/CustomerAssistant/ChatAssistant';

const { Header, Content, Sider } = Layout;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { Footer } = Layout;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { Title } = Typography;

const LOCAL_STORAGE_KEYS = {
  MODELS: 'model-comparison-models',
  SAVED_COMPARISONS: 'model-comparison-saved',
  PROMPT_TEMPLATES: 'model-comparison-prompts',
  SAVED_INPUTS: 'model-comparison-inputs',
  BATCH_JOBS: 'model-comparison-batch-jobs'
};

// 示例模型配置
const DEFAULT_MODELS: Model[] = [
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
  },
  {
    id: '8',
    name: '火山引擎豆包-1.5-Pro',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    requestPath: '/api/v3/chat/completions',
    requestTemplate: '{"model": "doubao-1.5-pro-32k-250115", "messages": [{"role": "system", "content": "{prompt}"}, {"role": "user", "content": "{input}"}]}',
    forceModelName: 'doubao-1.5-pro-32k-250115',
    supportsStreaming: true
  },
  {
    id: '9',
    name: '火山引擎豆包-1.5-Turbo',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    requestPath: '/api/v3/chat/completions',
    requestTemplate: '{"model": "doubao-1.5-turbo-32k-220615", "messages": [{"role": "system", "content": "{prompt}"}, {"role": "user", "content": "{input}"}]}',
    forceModelName: 'doubao-1.5-turbo-32k-220615',
    supportsStreaming: true
  },
  {
    id: '10',
    name: 'Qwen2.5-VL-32B (图像分析)',
    baseUrl: 'https://api.openrouter.ai',
    requestPath: '/api/v1/chat/completions',
    requestTemplate: '{ "model": "qwen/qwen2.5-vl-32b-instruct:free", "messages": [{"role": "user", "content": [{"type": "text", "text": "{prompt}"}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,{image}"}}]}] }',
    forceModelName: 'qwen/qwen2.5-vl-32b-instruct:free',
    supportsStreaming: true,
    apiKey: '请在这里填入您的OpenRouter API密钥',
    tags: ['免费', 'VPN', '图像分析']
  }
];

// 默认提示词模板
const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
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
  },
  {
    id: '3',
    title: '火山引擎豆包测试',
    description: '用于测试火山引擎豆包模型的响应能力',
    prompt: '你是一个专业的AI助手。请对以下内容进行分析，并提供详细、专业的见解和建议。'
  },
  {
    id: '4',
    title: '判责结果评测',
    description: '用于评估大模型判责结果的合理性',
    prompt: '你是一个专业的大模型判责结果评估专家。你需要评估以下由大模型做出的判责结果是否合理。\n\n' +
      '请根据以下内容分析判责结果是否合理，给出你的分析和建议：\n' +
      '1. 判断大模型给出的结果是否合理（合理/不合理/需人工判断）\n' +
      '2. 分析理由（为什么合理或不合理，或为什么需要人工判断）\n' +
      '3. 你对此判断的置信度（0-100的数字）\n\n' +
      '请按照以下格式输出你的分析结果：\n' +
      '结论：[合理/不合理/需人工判断]\n' +
      '置信度：[0-100]\n' +
      '分析：[详细分析理由]'
  }
];

function App() {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token
  } = theme.useToken();
  const [models, setModels] = useState<Model[]>([]);
  const [responses, setResponses] = useState<ModelResponse[]>([]);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [activeTab, setActiveTab] = useState('compare');
  const [savedInputs, setSavedInputs] = useState<SavedInput[]>([]);
  const [saveInputModalVisible, setSaveInputModalVisible] = useState(false);
  const [saveInputTitle, setSaveInputTitle] = useState('');
  const [savedBatchJobs, setSavedBatchJobs] = useState<BatchJob[]>([]);
  const [enablePreprocess, setEnablePreprocess] = useState(false);
  const [preprocessOptions, setPreprocessOptions] = useState({
    removeTimestamps: true,
    removeHtmlTags: true,
    normalizeWhitespace: true,
    removeDataMarkers: true,
    removeSpecialChars: true,
    enhanceRoles: false
  });

  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({
    "司机": "司机",
    "用户": "用户"
  });

  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig>({
    enabled: false,
    webhook: '',
    secret: ''
  });

  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 在App函数中第一个useEffect钩子添加设置页面标题的代码
  useEffect(() => {
    // 设置页面标题
    document.title = 'Mars模型评测平台';

    const savedModels = localStorage.getItem(LOCAL_STORAGE_KEYS.MODELS);
    if (savedModels) {
      try {
        setModels(JSON.parse(savedModels));
      } catch (error) {
        console.error('加载保存的模型配置失败:', error);
        setModels(DEFAULT_MODELS);
      }
    } else {
      setModels(DEFAULT_MODELS);
    }

    const savedComparisonsData = localStorage.getItem(LOCAL_STORAGE_KEYS.SAVED_COMPARISONS);
    if (savedComparisonsData) {
      try {
        setSavedComparisons(JSON.parse(savedComparisonsData));
      } catch (error) {
        console.error('加载保存的比较结果失败:', error);
      }
    }

    const savedPromptTemplates = localStorage.getItem(LOCAL_STORAGE_KEYS.PROMPT_TEMPLATES);
    if (savedPromptTemplates) {
      try {
        setPromptTemplates(JSON.parse(savedPromptTemplates));
      } catch (error) {
        console.error('加载保存的提示词模板失败:', error);
        setPromptTemplates(DEFAULT_PROMPT_TEMPLATES);
      }
    } else {
      setPromptTemplates(DEFAULT_PROMPT_TEMPLATES);
    }
  }, []);

  // 保存模型配置到本地存储
  useEffect(() => {
    if (models.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.MODELS, JSON.stringify(models));
    }
  }, [models]);

  // 保存比较结果到本地存储
  useEffect(() => {
    if (savedComparisons.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SAVED_COMPARISONS, JSON.stringify(savedComparisons));
    }
  }, [savedComparisons]);

  // 保存提示词模板到本地存储
  useEffect(() => {
    if (promptTemplates.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PROMPT_TEMPLATES, JSON.stringify(promptTemplates));
    }
  }, [promptTemplates]);

  // 从本地存储加载输入数据
  useEffect(() => {
    const savedInputsData = localStorage.getItem(LOCAL_STORAGE_KEYS.SAVED_INPUTS);
    if (savedInputsData) {
      try {
        setSavedInputs(JSON.parse(savedInputsData));
      } catch (error) {
        console.error('加载保存的输入内容失败:', error);
      }
    }
  }, []);

  // 保存输入内容到本地存储
  useEffect(() => {
    if (savedInputs.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SAVED_INPUTS, JSON.stringify(savedInputs));
    }
  }, [savedInputs]);

  // 从本地存储加载批处理任务
  useEffect(() => {
    const savedBatchJobsData = localStorage.getItem(LOCAL_STORAGE_KEYS.BATCH_JOBS);
    if (savedBatchJobsData) {
      try {
        setSavedBatchJobs(JSON.parse(savedBatchJobsData));
      } catch (error) {
        console.error('加载保存的批处理任务失败:', error);
      }
    }
  }, []);

  // 修改保存批处理任务函数，优化存储方式以避免配额问题
  const handleSaveBatchJob = (job: BatchJob) => {
    // 检查是否已存在相同ID的任务，如果有则更新
    const existingIndex = savedBatchJobs.findIndex(j => j.id === job.id);
    
    try {
      // 对批处理任务进行压缩处理，减小存储大小
      const optimizedJob: BatchJob = {
        ...job,
        // 压缩原始数据，如果数据量大，只保留最必要的信息
        originalData: job.originalData.map((item: ExcelItem) => {
          // 只保留必要的列，减少数据体积
          const { _rowId } = item;
          const result: ExcelItem = { _rowId };
          
          // 保留输入列和少量其他列
          result[job.inputColumnKey] = item[job.inputColumnKey];
          
          // 最多保留额外3个关键列
          let count = 0;
          for (const key in item) {
            if (key !== '_rowId' && key !== job.inputColumnKey && count < 3) {
              result[key] = item[key];
              count++;
            }
          }
          
          return result;
        })
      };
      
      // 更新或添加任务
      let updatedJobs: BatchJob[];
      if (existingIndex >= 0) {
        updatedJobs = [...savedBatchJobs];
        updatedJobs[existingIndex] = optimizedJob;
      } else {
        updatedJobs = [optimizedJob, ...savedBatchJobs];
      }
      
      // 限制保存的任务数量，防止localStorage溢出
      const MAX_SAVED_JOBS = 20;
      if (updatedJobs.length > MAX_SAVED_JOBS) {
        updatedJobs = updatedJobs.slice(0, MAX_SAVED_JOBS);
        message.info(`为防止存储空间不足，仅保留最近的${MAX_SAVED_JOBS}个任务`);
      }
      
      // 尝试存储到localStorage
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.BATCH_JOBS, JSON.stringify(updatedJobs));
        setSavedBatchJobs(updatedJobs);
      } catch (storageError) {
        // 如果存储失败（通常是因为超出配额），进一步压缩或移除旧数据
        console.error('保存批处理任务失败，正在尝试压缩数据', storageError);
        
        // 只保留最新的几个任务
        const reducedJobs = updatedJobs.slice(0, 5);
        
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.BATCH_JOBS, JSON.stringify(reducedJobs));
          setSavedBatchJobs(reducedJobs);
          message.warning('由于存储空间有限，仅保留了最近5个任务');
        } catch (finalError) {
          console.error('即使压缩后仍无法保存任务', finalError);
          message.error('无法保存任务，localStorage空间不足');
          
          // 清除所有批处理任务并只保存当前任务
          try {
            const singleJob = [optimizedJob];
            localStorage.setItem(LOCAL_STORAGE_KEYS.BATCH_JOBS, JSON.stringify(singleJob));
            setSavedBatchJobs(singleJob);
            message.warning('已清除所有历史任务并仅保存当前任务');
          } catch (lastError) {
            // 如果还是失败，则清空批处理任务存储
            localStorage.removeItem(LOCAL_STORAGE_KEYS.BATCH_JOBS);
            setSavedBatchJobs([]);
            message.error('存储空间严重不足，已清空所有任务');
          }
        }
      }
    } catch (error) {
      console.error('保存批处理任务时出错:', error);
      message.error('保存批处理任务失败');
    }
  };

  // 修改保存批处理任务到本地存储的useEffect，添加错误处理
  useEffect(() => {
    if (savedBatchJobs.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.BATCH_JOBS, JSON.stringify(savedBatchJobs));
      } catch (error) {
        console.error('保存批处理任务到localStorage失败:', error);
        // 存储失败时不显示错误提示，因为handleSaveBatchJob已经处理了这种情况
      }
    }
  }, [savedBatchJobs]);

  const handleCompare = async (selectedModelIds: string[], prompt: string, input: string, enablePreprocess: boolean) => {
    setIsLoading(true);
    setResponses([]);

    // 处理输入文本
    let processedInput = input;
    if (enablePreprocess) {
      // 如果启用了角色增强功能，使用 enhanceRoles 处理
      if (preprocessOptions.enhanceRoles) {
        processedInput = enhanceRoles(input, speakerMap);
      } else {
        // 否则进行基本的文本预处理
        const processors: ((text: string) => string)[] = [];
        
        if (preprocessOptions.removeTimestamps) {
          processedInput = processedInput.replace(/\[\d+::\d+::\d+-\d+::\d+::\d+\]/g, '');
        }
        
        if (preprocessOptions.removeHtmlTags) {
          processedInput = processedInput.replace(/<[^>]*>/g, '');
        }
        
        if (preprocessOptions.normalizeWhitespace) {
          processedInput = processedInput.replace(/\s+/g, ' ').trim();
        }
        
        if (preprocessOptions.removeDataMarkers) {
          processedInput = processedInput
            .replace(/\[DATA\]/g, '')
            .replace(/<DATA>/g, '')
            .replace(/\{DATA\}/g, '')
            .replace(/\[\d+\]/g, '');
        }
        
        if (preprocessOptions.removeSpecialChars) {
          processedInput = processedInput.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        }
      }
    }

    try {
      const selectedModels = models.filter(model => selectedModelIds.includes(model.id));
      const responsePromises = selectedModels.map(model => 
        callModel(model, prompt, processedInput, {
          temperature: 0.1,
          enablePreprocess
        })
          .then(response => ({
            ...response,
            prompt,
            input: processedInput,
            processedInput: enablePreprocess ? processedInput : undefined
          }))
          .catch(error => ({
            modelId: model.id,
            modelName: model.name,
            prompt,
            input: processedInput,
            processedInput: enablePreprocess ? processedInput : undefined,
            content: `错误: ${error.message || '调用模型失败'}`,
            rawResponse: null,
            error: error.message || '调用模型失败',
            responseTime: 0
          }))
      );

      const results = await Promise.all(responsePromises);
      setResponses(results);
      message.success('评测完成');
    } catch (error) {
      console.error('比较模型时出错:', error);
      message.error('比较模型时出错，请检查网络或API密钥配置');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResult = () => {
    if (responses.length === 0) {
      message.warning('没有可保存的结果');
      return;
    }
    
    setSaveTitle(`评测结果 ${new Date().toLocaleString()}`);
    setSaveModalVisible(true);
  };

  const confirmSaveResult = () => {
    if (!saveTitle.trim()) {
      message.warning('请输入标题');
      return;
    }

    const newSavedComparison: SavedComparison = {
      id: Date.now().toString(),
      title: saveTitle.trim(),
      prompt: currentPrompt,
      input: currentInput,
      responses,
      timestamp: Date.now(),
    };

    setSavedComparisons([newSavedComparison, ...savedComparisons]);
    setSaveModalVisible(false);
    message.success('保存成功');
  };

  const handleDeleteSavedComparison = (id: string) => {
    setSavedComparisons(savedComparisons.filter(c => c.id !== id));
    message.success('删除成功');
  };

  const handleRenameSavedComparison = (id: string, newTitle: string) => {
    setSavedComparisons(
      savedComparisons.map(c => c.id === id ? { ...c, title: newTitle } : c)
    );
    message.success('重命名成功');
  };

  const handleLoadSavedComparison = (comparison: SavedComparison) => {
    setResponses(comparison.responses);
    setCurrentPrompt(comparison.prompt);
    setCurrentInput(comparison.input);
    setActiveTab('compare');
    message.success('加载成功');
  };

  const handleExportAllSavedComparisons = () => {
    if (savedComparisons.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }

    const dataStr = JSON.stringify(savedComparisons, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `model-comparisons-export-${new Date().getTime()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    message.success('导出成功');
  };

  const handleImportSavedComparisons = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        if (Array.isArray(importedData)) {
          setSavedComparisons([...importedData, ...savedComparisons]);
          message.success(`成功导入 ${importedData.length} 条记录`);
        } else {
          message.error('导入的数据格式无效');
        }
      } catch (error) {
        console.error('导入数据失败:', error);
        message.error('导入数据失败');
      }
    };
    
    reader.readAsText(file);
  };

  const handleSelectPromptTemplate = (template: PromptTemplate) => {
    setCurrentPrompt(template.prompt);
    setActiveTab('compare');
    message.success('已加载提示词模板');
  };

  const handleSaveInput = () => {
    if (!currentPrompt.trim() && !currentInput.trim()) {
      message.warning('没有可保存的输入内容');
      return;
    }
    
    setSaveInputTitle(`输入 ${new Date().toLocaleString()}`);
    setSaveInputModalVisible(true);
  };

  const confirmSaveInput = () => {
    if (!saveInputTitle.trim()) {
      message.warning('请输入标题');
      return;
    }

    const newSavedInput: SavedInput = {
      id: Date.now().toString(),
      title: saveInputTitle.trim(),
      prompt: currentPrompt,
      input: currentInput,
      timestamp: Date.now(),
    };

    setSavedInputs([newSavedInput, ...savedInputs]);
    setSaveInputModalVisible(false);
    message.success('保存输入内容成功');
  };

  const handleDeleteSavedInput = (id: string) => {
    setSavedInputs(savedInputs.filter(input => input.id !== id));
    message.success('删除成功');
  };

  const handleRenameSavedInput = (id: string, newTitle: string) => {
    setSavedInputs(
      savedInputs.map(input => input.id === id ? { ...input, title: newTitle } : input)
    );
    message.success('重命名成功');
  };

  const handleLoadSavedInput = (savedInput: SavedInput) => {
    setCurrentPrompt(savedInput.prompt);
    setCurrentInput(savedInput.input);
    setActiveTab('compare');
    message.success('加载成功');
  };

  const handleFeishuConfigChange = (config: FeishuConfig) => {
    setFeishuConfig(config);
    // 可以保存到localStorage
    try {
      localStorage.setItem('feishu-config', JSON.stringify(config));
    } catch (error) {
      console.error('保存飞书配置失败:', error);
    }
  };

  // 在useEffect中加载保存的飞书配置
  useEffect(() => {
    // 读取已保存的飞书配置
    try {
      const savedFeishuConfig = localStorage.getItem('feishu-config');
      if (savedFeishuConfig) {
        setFeishuConfig(JSON.parse(savedFeishuConfig));
      }
    } catch (error) {
      console.error('读取飞书配置失败:', error);
    }
  }, []);

  return (
    <>
      <Layout className="layout">
        <Header className="header">
          <div className="header-content">
            <div className="logo">
              {isMobile && (
                <Button
                  type="text"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setCollapsed(!collapsed)}
                  style={{ color: 'white', fontSize: '16px', marginRight: '8px' }}
                />
              )}
              <DashboardOutlined style={{ fontSize: '24px', color: 'white', marginRight: '8px' }} />
              <Typography.Title level={4} style={{ margin: 0, color: 'white' }}>Mars模型评测平台</Typography.Title>
            </div>
            
            {/* 在非移动端或者菜单展开状态下显示菜单 */}
            {(!isMobile || !collapsed) && (
              <Menu 
                theme="dark" 
                mode={isMobile ? "inline" : "horizontal"}
                selectedKeys={[activeTab]}
                onSelect={({ key }) => {
                  setActiveTab(key as string);
                  if (isMobile) setCollapsed(true);
                }}
                style={{ 
                  background: 'transparent', 
                  borderBottom: 'none',
                  flex: 1
                }}
              >
                <Menu.Item key="compare" icon={<SyncOutlined />}>
                  模型比较
                </Menu.Item>
                <Menu.Item key="batch" icon={<FileExcelOutlined />}>
                  批量数据评测
                </Menu.Item>
                <Menu.Item key="prompts" icon={<FileTextOutlined />}>
                  提示词模板
                </Menu.Item>
                <Menu.Item key="excel" icon={<TableOutlined />}>
                  Excel处理
                </Menu.Item>
                <Menu.Item key="judgment" icon={<AuditOutlined />}>
                  模型处理结果评测
                </Menu.Item>
                <Menu.Item key="chart" icon={<BarChartOutlined />}>
                  数据分析与图表
                </Menu.Item>
                <Menu.Item key="image" icon={<CameraOutlined />}>
                  图像分析
                </Menu.Item>
                <Menu.Item key="settings" icon={<SettingOutlined />}>
                  模型配置
                </Menu.Item>
                <Menu.Item key="saved" icon={<HistoryOutlined />}>
                  历史记录
                </Menu.Item>
                <Menu.Item key="feishu" icon={<SendOutlined />}>
                  系统通知配置
                </Menu.Item>
              </Menu>
            )}
          </div>
        </Header>
        
        <Content>
          <div className="site-layout-content">
            <div className="content-container">
              {activeTab === 'compare' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <SyncOutlined /> 模型比较
                    </Typography.Title>
                    <Typography.Text type="secondary">比较不同模型的输出结果，分析差异</Typography.Text>
                  </div>
                  <div className="main-layout" style={{ flexDirection: 'column' }}>
                    <div className="form-container" style={{ width: '100%', maxWidth: '100%' }}>
                      <ComparisonForm
                        models={models}
                        isLoading={isLoading}
                        currentPrompt={currentPrompt}
                        currentInput={currentInput}
                        onPromptChange={setCurrentPrompt}
                        onInputChange={setCurrentInput}
                        onCompare={(selectedModelIds, prompt, input) => 
                          handleCompare(selectedModelIds, prompt, input, enablePreprocess)
                        }
                        onSaveResult={handleSaveResult}
                        onSaveInput={handleSaveInput}
                        enablePreprocess={enablePreprocess}
                        onEnablePreprocessChange={setEnablePreprocess}
                        preprocessOptions={preprocessOptions}
                        onPreprocessOptionsChange={setPreprocessOptions}
                        speakerMap={speakerMap}
                        onSpeakerMapChange={setSpeakerMap}
                      />
                    </div>
                    <div className="results-container" style={{ width: '100%', maxWidth: '100%' }}>
                      <ComparisonResults
                        isLoading={isLoading}
                        responses={responses}
                        prompt={currentPrompt}
                        input={currentInput}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'batch' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <FileExcelOutlined /> 批量数据评测
                    </Typography.Title>
                    <Typography.Text type="secondary">批量处理大量数据，提高评测效率</Typography.Text>
                  </div>
                  <BatchProcessing
                    models={models}
                    onSaveBatchJob={handleSaveBatchJob}
                    savedBatchJobs={savedBatchJobs}
                    promptTemplates={promptTemplates}
                    feishuConfig={feishuConfig}
                    onFeishuConfigChange={handleFeishuConfigChange}
                  />
                </div>
              )}
              
              {activeTab === 'prompts' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <FileTextOutlined /> 提示词模板
                    </Typography.Title>
                    <Typography.Text type="secondary">管理常用提示词模板，提高评测一致性</Typography.Text>
                  </div>
                  <PromptTemplates
                    templates={promptTemplates}
                    onTemplatesChange={setPromptTemplates}
                    onSelect={handleSelectPromptTemplate}
                  />
                </div>
              )}
              
              {activeTab === 'excel' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <TableOutlined /> Excel 处理工具
                    </Typography.Title>
                    <Typography.Text type="secondary">处理 Excel 表格，提取和筛选数据</Typography.Text>
                  </div>
                  <ExcelProcessor />
                </div>
              )}
              
              {activeTab === 'judgment' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <AuditOutlined /> 模型处理结果评测
                    </Typography.Title>
                    <Typography.Text type="secondary">分析大模型处理结果，评估正确性和可靠性</Typography.Text>
                  </div>
                  <JudgmentAnalyzer 
                    models={models}
                    promptTemplates={promptTemplates}
                  />
                </div>
              )}
              
              {activeTab === 'chart' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <BarChartOutlined /> 数据分析与图表
                    </Typography.Title>
                    <Typography.Text type="secondary">分析数据，生成图表，辅助决策</Typography.Text>
                  </div>
                  <ChartAnalyzer 
                    models={models}
                  />
                </div>
              )}
              
              {activeTab === 'settings' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <SettingOutlined /> 模型配置
                    </Typography.Title>
                    <Typography.Text type="secondary">配置模型参数和接口信息</Typography.Text>
                  </div>
                  <ModelConfig
                    models={models}
                    onModelsChange={setModels}
                  />
                </div>
              )}
              
              {activeTab === 'saved' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <HistoryOutlined /> 历史记录
                    </Typography.Title>
                    <Typography.Text type="secondary">查看和管理已保存的评测结果和输入</Typography.Text>
                  </div>
                  <SavedComparisons
                    savedComparisons={savedComparisons}
                    onLoad={handleLoadSavedComparison}
                    onDelete={handleDeleteSavedComparison}
                    onRename={handleRenameSavedComparison}
                    onExportAll={handleExportAllSavedComparisons}
                    onImport={handleImportSavedComparisons}
                    savedInputs={savedInputs}
                    onLoadInput={handleLoadSavedInput}
                    onDeleteInput={handleDeleteSavedInput}
                    onRenameInput={handleRenameSavedInput}
                  />
                </div>
              )}
              
              {activeTab === 'feishu' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <SendOutlined /> 系统通知配置
                    </Typography.Title>
                    <Typography.Text type="secondary">配置系统通知设置</Typography.Text>
                  </div>
                  <FeishuConfigComponent 
                    standalone={true}
                    config={feishuConfig} 
                    onChange={handleFeishuConfigChange} 
                  />
                </div>
              )}
              
              {activeTab === 'image' && (
                <div className="tab-content">
                  <div className="page-header">
                    <Typography.Title level={4}>
                      <CameraOutlined /> 图像分析
                    </Typography.Title>
                    <Typography.Text type="secondary">分析图像，提取特征，辅助决策</Typography.Text>
                  </div>
                  <ImageAnalyzer models={models} />
                </div>
              )}
            </div>
          </div>
        </Content>
        
        <Modal
          title="保存比较结果"
          open={saveModalVisible}
          onOk={confirmSaveResult}
          onCancel={() => setSaveModalVisible(false)}
          destroyOnClose
        >
          <Input
            placeholder="请输入标题"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            autoFocus
          />
        </Modal>

        <Modal
          title="保存输入内容"
          open={saveInputModalVisible}
          onOk={confirmSaveInput}
          onCancel={() => setSaveInputModalVisible(false)}
          destroyOnClose
        >
          <Input
            placeholder="请输入标题"
            value={saveInputTitle}
            onChange={(e) => setSaveInputTitle(e.target.value)}
            autoFocus
          />
        </Modal>
        
        <Layout.Footer style={{ textAlign: 'center', background: 'transparent' }}>
          Mars模型评测平台 ©{new Date().getFullYear()} 模型及数据测试分析工具
        </Layout.Footer>
      </Layout>
      
      {/* 客服小助手放在Layout外部 */}
      <ChatAssistant />
    </>
  );
}

export default App;
