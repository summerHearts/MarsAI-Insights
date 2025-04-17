import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  Select, 
  Input, 
  Progress, 
  Table, 
  Space, 
  message, 
  Tabs, 
  Typography, 
  Spin,
  Modal,
  Empty,
  List,
  InputNumber,
  Slider,
  Tooltip,
  Tag,
  Switch,
  Checkbox,
  Collapse,
  Alert
} from 'antd';
import { 
  UploadOutlined, 
  FileExcelOutlined, 
  PlayCircleOutlined, 
  FileAddOutlined,
  ExportOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FormOutlined,
  TeamOutlined,
  SendOutlined
} from '@ant-design/icons';
import { UploadFile } from 'antd/lib/upload/interface';
import { Model, ExcelItem, BatchJob, BatchProcessingStatus } from '../types';
import { callModel } from '../services/api';
import { excelToJson, getHeaders, jsonToExcel } from '../utils/excelHelpers';
import { PromptTemplate } from '../components/PromptTemplates';
import { 
  removeTimestamps, 
  removeHtmlTags, 
  normalizeWhitespace, 
  removeDataMarkers,
  applyProcessors,
  textProcessorPresets,
  enhanceRoles,
  processConversation
} from '../utils/textProcessors';
import { sendFeishuMessage, FeishuConfig } from '../services/feishuService';
import FeishuConfigComponent from './FeishuConfig';

const { Option } = Select;
const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

interface BatchProcessingProps {
  models: Model[];
  onSaveBatchJob: (job: BatchJob) => void;
  savedBatchJobs: BatchJob[];
  promptTemplates: PromptTemplate[];
  feishuConfig: FeishuConfig;
  onFeishuConfigChange: (config: FeishuConfig) => void;
}

const BatchProcessing: React.FC<BatchProcessingProps> = ({ 
  models,
  onSaveBatchJob,
  savedBatchJobs,
  promptTemplates,
  feishuConfig,
  onFeishuConfigChange
}) => {
  const [file, setFile] = useState<UploadFile | null>(null);
  const [excelData, setExcelData] = useState<ExcelItem[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [inputColumn, setInputColumn] = useState<string>('');
  const [outputColumn, setOutputColumn] = useState<string>('模型输出');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shouldStop, setShouldStop] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<BatchProcessingStatus>({
    totalItems: 0,
    processedItems: 0,
    success: 0,
    failed: 0,
    isProcessing: false
  });
  const [currentBatchJob, setCurrentBatchJob] = useState<BatchJob | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [saveJobModalVisible, setSaveJobModalVisible] = useState<boolean>(false);
  const [jobTitle, setJobTitle] = useState<string>('');
  const [lastProcessedIndex, setLastProcessedIndex] = useState<number>(-1);
  const [activeTabKey, setActiveTabKey] = useState<string>('upload');
  const [concurrency, setConcurrency] = useState<number>(5);
  const [maxConcurrency, setMaxConcurrency] = useState<number>(20);

  // 添加文本预处理相关状态
  const [enableTextProcessing, setEnableTextProcessing] = useState<boolean>(false);
  const [textProcessors, setTextProcessors] = useState<{
    removeTimestamps: boolean;
    removeHtmlTags: boolean;
    normalizeWhitespace: boolean;
    removeDataMarkers: boolean;
    enhanceRoles: boolean;
  }>({
    removeTimestamps: true,
    removeHtmlTags: false,
    normalizeWhitespace: true,
    removeDataMarkers: false,
    enhanceRoles: false
  });
  const [customPatterns, setCustomPatterns] = useState<string>('');
  const [processorPreset, setProcessorPreset] = useState<string>('custom');
  const [speakerMap, setSpeakerMap] = useState<string>(JSON.stringify({
    "司机": "司机",
    "用户": "用户",
    "乘客": "用户",
    "客人": "用户",
    "系统": "系统"
  }, null, 2));

  // 添加自动保存相关的引用
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPausedRef = useRef<boolean>(false);
  const shouldStopRef = useRef<boolean>(false);

  // 自动保存当前任务
  const autoSaveCurrentJob = useCallback(() => {
    if (!currentBatchJob || isProcessing) return;

    // 更新当前任务
    const updatedJob: BatchJob = {
      ...currentBatchJob,
      timestamp: Date.now(), // 更新时间戳
      title: currentBatchJob.title || `批处理任务 ${new Date().toLocaleString()}`
    };

    onSaveBatchJob(updatedJob);
  }, [currentBatchJob, isProcessing, onSaveBatchJob]);

  // 处理标签页切换
  const handleTabChange = (newTabKey: string) => {
    // 如果从上传页面切换出去，自动保存当前任务
    if (activeTabKey === 'upload' && newTabKey !== 'upload') {
      autoSaveCurrentJob();
    }
    setActiveTabKey(newTabKey);
  };

  // 在组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // 读取Excel文件
  const handleFileUpload = async (file: File) => {
    try {
      // 保存文件对象，确保界面能显示文件名
      setFile(file as unknown as UploadFile);
      
      const jsonData = await excelToJson(file);
      
      // 获取表头
      const headerKeys = getHeaders(jsonData);
      setHeaders(headerKeys);
      
      // 默认选择第一列作为输入
      if (headerKeys.length > 0 && !inputColumn) {
        setInputColumn(headerKeys[0]);
      }
      
      setExcelData(jsonData);
      message.success(`成功解析 ${jsonData.length} 行数据`);

      // 创建新的批处理任务
      const newBatchJob: BatchJob = {
        id: Date.now().toString(),
        title: `批处理任务 ${new Date().toLocaleString()}`,
        timestamp: Date.now(),
        modelId: selectedModel,
        prompt: prompt,
        inputColumnKey: inputColumn,
        status: {
          totalItems: jsonData.length,
          processedItems: 0,
          success: 0,
          failed: 0,
          isProcessing: false
        },
        originalData: jsonData,
        processedData: [],
        outputColumnKey: outputColumn,
        headers: headerKeys,
        notifyOnComplete: feishuConfig.enabled,
        feishuConfig: feishuConfig
      };
      
      setCurrentBatchJob(newBatchJob);
      return false; // 阻止上传
    } catch (error) {
      console.error('解析Excel文件失败:', error);
      message.error('解析Excel文件失败');
      return false;
    }
  };

  // 开始批处理
  const startProcessing = async (startFromIndex: number = 0) => {
    if (!currentBatchJob) {
      message.error('请先上传Excel文件');
      return;
    }

    if (!selectedModel) {
      message.error('请选择模型');
      return;
    }

    if (!prompt.trim()) {
      message.error('请输入提示词');
      return;
    }

    if (!inputColumn) {
      message.error('请选择输入列');
      return;
    }

    const selectedModelObj = models.find(m => m.id === selectedModel);
    if (!selectedModelObj) {
      message.error('所选模型无效');
      return;
    }

    // 重置控制状态
    setShouldStop(false);
    shouldStopRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;

    // 更新批处理状态
    setIsProcessing(true);
    
    // 如果是重新开始处理（而不是恢复），则重置处理状态和数据
    let processedData: ExcelItem[] = [];
    let successCount = 0;
    let failedCount = 0;
    
    if (startFromIndex === 0) {
      // 完全重新开始处理
      setProcessingStatus({
        totalItems: excelData.length,
        processedItems: 0,
        success: 0,
        failed: 0,
        isProcessing: true
      });
      
      // 更新当前批处理任务
      const updatedBatchJob = {
        ...currentBatchJob,
        modelId: selectedModel,
        prompt: prompt,
        inputColumnKey: inputColumn,
        outputColumnKey: outputColumn,
        status: {
          totalItems: excelData.length,
          processedItems: 0,
          success: 0,
          failed: 0,
          isProcessing: true
        },
        processedData: []
      };
      setCurrentBatchJob(updatedBatchJob);
    } else {
      // 恢复处理，使用已有的处理结果
      processedData = [...(currentBatchJob.processedData || [])];
      successCount = processedData.filter(item => !item[outputColumn]?.toString().startsWith('处理失败:')).length;
      failedCount = processedData.length - successCount;
      
      // 更新处理状态
      setProcessingStatus({
        totalItems: excelData.length,
        processedItems: processedData.length,
        success: successCount,
        failed: failedCount,
        isProcessing: true
      });
      
      message.info(`从第 ${startFromIndex + 1} 行继续处理，已完成 ${processedData.length} 行`);
    }

    // 创建一个引用，用于检查组件是否已卸载
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let isMounted = true;
    
    // 并发处理逻辑
    const processItem = async (index: number): Promise<{ success: boolean, item: ExcelItem }> => {
      const item = excelData[index];
      let inputText = item[inputColumn]?.toString() || '';
      
      // 记录处理开始的日志
      console.log(`========== 开始处理第 ${index + 1} 行数据 ==========`);
      console.log(`原始输入: ${inputText.substring(0, 100)}${inputText.length > 100 ? '...' : ''}`);
      
      // 应用文本预处理
      if (enableTextProcessing) {
        // 如果使用预设
        if (processorPreset !== 'custom') {
          // 使用对话处理预设
          if (processorPreset === 'conversation') {
            let speakerMapObj = {};
            try {
              speakerMapObj = JSON.parse(speakerMap);
            } catch (err) {
              console.error('角色映射配置解析失败，使用默认配置', err);
            }
            inputText = processConversation(inputText, speakerMapObj);
          } else {
            // 使用其他预设
            inputText = processorPreset === 'basic' 
              ? textProcessorPresets.basic(inputText)
              : textProcessorPresets.complete(inputText);
          }
        } else {
          // 使用自定义设置
          const processors: ((text: string) => string)[] = [];
          
          if (textProcessors.removeTimestamps) {
            processors.push(removeTimestamps);
          }
          if (textProcessors.removeHtmlTags) {
            processors.push(removeHtmlTags);
          }
          if (textProcessors.normalizeWhitespace) {
            processors.push(normalizeWhitespace);
          }
          if (textProcessors.removeDataMarkers && customPatterns.trim()) {
            // 将自定义模式拆分为数组
            const patterns = customPatterns
              .split('\n')
              .map(p => p.trim())
              .filter(p => p);
            processors.push((text) => removeDataMarkers(text, patterns));
          }
          if (textProcessors.enhanceRoles) {
            // 应用角色增强处理
            try {
              const speakerMapObj = JSON.parse(speakerMap);
              processors.push((text) => enhanceRoles(text, speakerMapObj));
            } catch (err) {
              console.error('角色映射配置解析失败，使用默认配置', err);
              processors.push(enhanceRoles);
            }
          }
          
          if (processors.length > 0) {
            inputText = applyProcessors(inputText, processors);
          }
        }
        
        // 记录处理后的输入文本
        console.log(`处理后的输入: ${inputText.substring(0, 100)}${inputText.length > 100 ? '...' : ''}`);
      }
      
      // 声明processedItem在外部，这样catch块外部也能访问
      let processedItem: ExcelItem = {
        ...item,
        _rowId: item._rowId // 确保保留行ID
      };
      
      try {
        // 调用模型API
        console.log(`向模型 ${selectedModelObj.name} 发送请求...`);
        const response = await callModel(selectedModelObj, prompt, inputText);
        
        // 处理输出数据不需要重新声明processedItem
        // processedItem已经在外部声明
        
        // 检查输出是否为JSON格式字符串
        let jsonData: any;
        let cleanedContent = response.content;

        // 检查是否包含```json和```标记，如果有则提取中间的内容
        const jsonMarkdownMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMarkdownMatch && jsonMarkdownMatch[1]) {
          console.log(`第 ${index + 1} 行: 检测到Markdown格式的JSON代码块，提取内部内容`);
          cleanedContent = jsonMarkdownMatch[1].trim();
        }

        try {
          jsonData = JSON.parse(cleanedContent);
          console.log(`第 ${index + 1} 行: JSON解析成功`, typeof jsonData);
          
          // 额外检查解析后的数据是否为null或undefined
          if (jsonData === null || jsonData === undefined) {
            console.log(`第 ${index + 1} 行: JSON解析结果为空值，使用原始响应`);
            processedItem[outputColumn] = response.content || '';
            return { success: true, item: processedItem };
          }
          
          // 更新原始输出列为清理后的JSON
          processedItem[outputColumn] = cleanedContent;
        } catch (parseError) {
          // JSON解析失败，使用原始响应内容
          console.log(`第 ${index + 1} 行: 非JSON格式，使用原始响应`, parseError);
          processedItem[outputColumn] = response.content;
          return { success: true, item: processedItem };
        }
        
        // 如果是数组（角色增强后的格式通常是数组）
        if (Array.isArray(jsonData)) {
          console.log(`第 ${index + 1} 行: 结果是数组格式，长度: ${jsonData.length}`);
          // 基本输出列仍然保留完整JSON
          processedItem[outputColumn] = response.content;
          
          // 对于角色增强的数据，将每个角色的对话内容单独提取为列
          jsonData.forEach((dialogItem: any, dialogIndex: number) => {
            // 处理角色-内容对，添加更严格的空值检查
            if (dialogItem && typeof dialogItem === 'object') {
              // 检查角色字段
              const roleName = dialogItem.角色 || dialogItem.role || '';
              if (roleName) {
                processedItem[`${outputColumn}_角色${dialogIndex+1}`] = roleName;
                console.log(`第 ${index + 1} 行: 角色${dialogIndex+1} = ${roleName}`);
              }
              
              // 检查内容字段，支持多种可能的键名
              const content = dialogItem.内容 || dialogItem.content || dialogItem.text || '';
              if (content) {
                processedItem[`${outputColumn}_内容${dialogIndex+1}`] = content;
                console.log(`第 ${index + 1} 行: 内容${dialogIndex+1} = ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
              }
            }
          });
          
          // 添加结构化标记，用于UI显示和导出时识别
          processedItem['_hasStructuredOutput'] = true;
        } else if (typeof jsonData === 'object' && jsonData !== null) {
          // 如果是非数组对象，则将每个属性映射为单独的列
          console.log(`第 ${index + 1} 行: 结果是对象格式，键数量: ${Object.keys(jsonData).length}`);
          processedItem[outputColumn] = response.content;
          
          Object.entries(jsonData).forEach(([key, value]) => {
            if (key) {
              // 处理各种类型的值，确保空值被转换为空字符串
              let processedValue = '';
              
              if (value === null || value === undefined) {
                processedValue = '';
                console.log(`第 ${index + 1} 行: 对象属性 ${key} = 空值`);
              } else if (Array.isArray(value)) {
                // 对于数组类型的值，转换为逗号分隔的字符串
                processedValue = value.join(', ');
                console.log(`第 ${index + 1} 行: 对象属性 ${key} = 数组[${value.length}项]`);
                
                // 同时为数组中的每个元素创建单独的列(如果数组长度不超过5)
                if (value.length <= 5) {
                  value.forEach((item, index) => {
                    processedItem[`${outputColumn}_${key}_${index+1}`] = item !== null && item !== undefined ? String(item) : '';
                    console.log(`第 ${index + 1} 行: ${key}_${index+1} = ${String(item).substring(0, 30)}${String(item).length > 30 ? '...' : ''}`);
                  });
                }
              } else if (typeof value === 'object') {
                processedValue = JSON.stringify(value);
                console.log(`第 ${index + 1} 行: 对象属性 ${key} = 嵌套对象`);
              } else {
                processedValue = String(value);
                console.log(`第 ${index + 1} 行: 对象属性 ${key} = ${processedValue.substring(0, 30)}${processedValue.length > 30 ? '...' : ''}`);
              }
              
              processedItem[`${outputColumn}_${key}`] = processedValue;
            }
          });
          
          // 添加结构化标记
          processedItem['_hasStructuredOutput'] = true;
        } else {
          // 不是复杂结构，直接保存输出
          console.log(`第 ${index + 1} 行: 结果是简单值，类型: ${typeof jsonData}`);
          processedItem[outputColumn] = response.content;
        }
      } catch (error) {
        console.error(`处理第 ${index+1} 行时出错:`, error);
        
        // 创建带有错误信息的数据项
        processedItem = {
          ...item,
          [outputColumn]: `处理失败: ${(error as Error).message || '未知错误'}`
        };
        
        console.log(`========== 第 ${index + 1} 行处理失败 ==========`);
        return { success: false, item: processedItem };
      }
      
      console.log(`========== 第 ${index + 1} 行处理完成 ==========`);
      return { success: true, item: processedItem };
    };
    
    // 并发处理主逻辑
    const processBatch = async () => {
      let currentIndex = startFromIndex;
      
      // 用于跟踪正在处理的任务
      const activeTasks: { index: number; promise: Promise<{ success: boolean; item: ExcelItem }> }[] = [];
      let isActive = true;
      
      while (currentIndex < excelData.length && isActive) {
        // 检查是否暂停或停止
        if (shouldStopRef.current) {
          isActive = false;
          break;
        }
        
        if (isPausedRef.current) {
          isActive = false;
          break;
        }
        
        // 等待，如果当前活跃的任务数量达到了并发上限
        while (activeTasks.length >= concurrency && isActive) {
          if (shouldStopRef.current || isPausedRef.current) {
            isActive = false;
            break;
          }
          
          try {
            // 使用Promise.race等待任何一个任务完成
            await Promise.race(activeTasks.map(task => task.promise));
          } catch (error) {
            // 忽略任务失败的错误
            console.error('处理任务失败:', error);
          }
          
          // 过滤掉已完成的任务 - 使用Promise.race结果和setTimeout来确保有任务完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 检查每个任务是否已完成
          for (let i = activeTasks.length - 1; i >= 0; i--) {
            const task = activeTasks[i];
            
            // 如果任务已完成(fulfilled或rejected)，则从活跃任务列表中移除
            // 使用Promise.race和setTimeout已经确保至少有一个任务已完成
            // 这里我们尝试获取任务的结果，如果能立即获取表示任务已完成
            Promise.resolve(task.promise).then(
              () => {
                // 任务成功完成，从列表中移除
                const index = activeTasks.findIndex(t => t.index === task.index);
                if (index !== -1) {
                  activeTasks.splice(index, 1);
                }
              },
              () => {
                // 任务失败完成，从列表中移除
                const index = activeTasks.findIndex(t => t.index === task.index);
                if (index !== -1) {
                  activeTasks.splice(index, 1);
                }
              }
            );
          }
          
          // 短暂等待，避免过度消耗CPU
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        if (!isActive) break;
        
        // 创建新的处理任务
        const index = currentIndex++;
        setLastProcessedIndex(index);
        
        const taskPromise = processItem(index);
        
        // 添加到活跃任务列表
        activeTasks.push({ index, promise: taskPromise });
        
        // 设置任务完成后的处理
        taskPromise.then(
          (result) => {
            // 更新处理结果
            processedData[index] = result.item;
            
            // 更新统计信息
            if (result.success) {
              successCount++;
            } else {
              failedCount++;
            }
            
            // 更新处理状态
            const newStatus = {
              totalItems: excelData.length,
              processedItems: Math.min(processedData.filter(Boolean).length, excelData.length),
              success: successCount,
              failed: failedCount,
              isProcessing: true
            };
            
            setProcessingStatus(newStatus);
            
            // 更新当前批处理任务
            setCurrentBatchJob((prev: BatchJob | null) => {
              if (!prev) return null;
              return {
                ...prev,
                status: newStatus,
                processedData: [...processedData]
              };
            });
          },
          (error) => {
            console.error(`任务失败:`, error);
          }
        );
        
        // 短暂等待，避免请求过于密集
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // 等待所有活跃任务完成
      if (activeTasks.length > 0) {
        try {
          await Promise.all(activeTasks.map(task => task.promise));
        } catch (error) {
          console.error('等待所有任务完成时出错:', error);
        }
      }
      
      // 处理完成或暂停/终止
      if (shouldStopRef.current) {
        // 终止处理
        const stopStatus = {
          totalItems: excelData.length,
          processedItems: processedData.filter(Boolean).length,
          success: successCount,
          failed: failedCount,
          isProcessing: false
        };
        
        setProcessingStatus(stopStatus);
        setIsProcessing(false);
        
        // 更新当前批处理任务
        setCurrentBatchJob((prev: BatchJob | null) => {
          if (!prev) return null;
          return {
            ...prev,
            status: stopStatus,
            processedData: [...processedData]
          };
        });
        
        message.info(`已终止处理，当前已处理: ${processedData.filter(Boolean).length}/${excelData.length}`);
      } else if (isPausedRef.current) {
        // 暂停处理
        const pauseStatus = {
          totalItems: excelData.length,
          processedItems: processedData.filter(Boolean).length,
          success: successCount,
          failed: failedCount,
          isProcessing: false
        };
        
        setProcessingStatus(pauseStatus);
        setIsProcessing(false);
        
        // 更新当前批处理任务
        setCurrentBatchJob((prev: BatchJob | null) => {
          if (!prev) return null;
          return {
            ...prev,
            status: pauseStatus,
            processedData: [...processedData]
          };
        });
        
        message.info(`已暂停处理，当前已处理: ${processedData.filter(Boolean).length}/${excelData.length}`);
      } else {
        // 正常完成
        const finalStatus = {
          totalItems: excelData.length,
          processedItems: excelData.length,
          success: successCount,
          failed: failedCount,
          isProcessing: false
        };
        
        setProcessingStatus(finalStatus);
        setIsProcessing(false);
        
        // 更新当前批处理任务的最终状态
        setCurrentBatchJob((prev: BatchJob | null) => {
          if (!prev) return null;
          
          // 获取最终状态
          const finalStatus = {
            totalItems: excelData.length,
            processedItems: excelData.length,
            success: successCount,
            failed: failedCount,
            isProcessing: false
          };
          
          // 构建更新后的批处理任务
          const updatedBatchJob = {
            ...prev,
            processedData: [...processedData],
            status: finalStatus
          };
          
          // 如果所有项目都处理完成，且启用了飞书通知
          if (finalStatus.processedItems === finalStatus.totalItems && prev.notifyOnComplete && prev.feishuConfig?.enabled) {
            console.log('批处理完成，准备发送飞书通知...');
            
            // 构建飞书通知内容
            const messageTitle = `批处理任务完成: ${prev.title}`;
            const messageContent = [
              `**批处理任务完成**`,
              `- 任务名称: ${prev.title}`,
              `- 使用模型: ${models.find(m => m.id === prev.modelId)?.name || '未知模型'}`,
              `- 处理总数: ${finalStatus.totalItems}`,
              `- 成功数量: ${finalStatus.success}`,
              `- 失败数量: ${finalStatus.failed}`,
              `- 完成时间: ${new Date().toLocaleString()}`
            ].join('\n');
            
            // 确定消息状态
            let messageStatus: 'success' | 'warning' | 'error' | 'info' = 'success';
            if (finalStatus.failed > 0 && finalStatus.failed < finalStatus.totalItems / 2) {
              messageStatus = 'warning';
            } else if (finalStatus.failed >= finalStatus.totalItems / 2) {
              messageStatus = 'error';
            }
            
            // 发送飞书通知，使用全局配置
            sendFeishuMessage(feishuConfig, {
              title: messageTitle,
              content: messageContent,
              status: messageStatus
            }).then(success => {
              if (success) {
                message.success('批处理完成，已发送飞书通知');
              } else {
                message.warning('批处理完成，但飞书通知发送失败');
              }
            }).catch(error => {
              console.error('发送飞书通知时出错:', error);
              message.error('发送飞书通知失败: ' + (error instanceof Error ? error.message : '未知错误'));
            });
          }
          
          return updatedBatchJob;
        });
        
        message.success(`处理完成，共 ${excelData.length} 行，成功 ${successCount} 行，失败 ${failedCount} 行`);
      }
    };
    
    // 开始并发处理
    processBatch().catch(error => {
      console.error('批处理过程出错:', error);
      message.error('批处理过程出错');
      setIsProcessing(false);
    });
  };

  // 更新并发数变化处理函数，修复类型兼容问题
  const handleConcurrencyChange = (value: number | null) => {
    if (value !== null) {
      setConcurrency(value);
      // 如果当前正在处理，提示用户并发数已调整
      if (isProcessing) {
        message.info(`并发数已调整为 ${value}，将在下一批任务中生效`);
      }
    }
  };

  // 更新暂停和停止处理的函数，使其更清晰
  const pauseProcessing = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    message.info(`已暂停处理，当前进度: ${processingStatus.processedItems}/${processingStatus.totalItems}`);
  };

  const stopProcessing = () => {
    setShouldStop(true);
    shouldStopRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    message.warning('正在终止处理，请等待当前任务完成...');
  };

  const resumeProcessing = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    startProcessing(lastProcessedIndex + 1);
  };

  // 导出处理结果为Excel
  const exportToExcel = () => {
    try {
      if (!currentBatchJob || !currentBatchJob.processedData || currentBatchJob.processedData.length === 0) {
        message.warning('没有数据可导出');
        return;
      }
      
      // 创建一个有效数据源的副本，不包含null或undefined项
      const validDataSource = currentBatchJob.processedData.filter((item: ExcelItem | null) => item != null);
      
      if (validDataSource.length === 0) {
        message.warning('过滤无效数据后没有内容可导出');
        return;
      }
      
      // 使用当前时间创建文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
      const filename = `批量处理结果_${timestamp}`;
      
      // 传入原始表头和输出列名，以便只导出需要的列
      jsonToExcel(validDataSource, filename, headers, outputColumn);
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error(`导出失败: ${(error as Error).message || '未知错误'}`);
    }
  };

  // 保存批处理任务
  const handleSaveJob = () => {
    if (!currentBatchJob) {
      message.error('没有可保存的任务');
      return;
    }
    
    if (isProcessing && !isPausedRef.current) {
      message.error('请暂停或等待处理完成后再保存');
      return;
    }
    
    setJobTitle(`批处理任务 ${new Date().toLocaleString()}`);
    setSaveJobModalVisible(true);
  };

  // 确认保存批处理任务
  const confirmSaveJob = () => {
    if (!currentBatchJob) return;
    
    if (!jobTitle.trim()) {
      message.warning('请输入任务标题');
      return;
    }
    
    const jobToSave: BatchJob = {
      ...currentBatchJob,
      title: jobTitle.trim()
    };
    
    onSaveBatchJob(jobToSave);
    setSaveJobModalVisible(false);
    message.success('保存成功');
  };

  // 加载保存的批处理任务
  const loadBatchJob = (jobId: string) => {
    const job = savedBatchJobs.find(j => j.id === jobId);
    if (job) {
      setCurrentBatchJob(job);
      setSelectedModel(job.modelId);
      setPrompt(job.prompt);
      setInputColumn(job.inputColumnKey);
      setOutputColumn(job.outputColumnKey);
      setExcelData(job.originalData);
      setHeaders(job.headers);
      
      // 使用保存的处理状态
      setProcessingStatus(job.status);
      setActiveJobId(job.id);
      
      // 根据任务的处理进度设置暂停状态
      const isPartiallyProcessed = job.processedData.length > 0 && 
                                  job.processedData.length < job.originalData.length;
      
      if (isPartiallyProcessed) {
        // 任务已经处理了部分数据，但尚未完成
        setIsPaused(true);
        isPausedRef.current = true;
        setLastProcessedIndex(job.processedData.length - 1);
        message.info(`已加载到第 ${job.processedData.length}/${job.originalData.length} 行，可继续处理`);
      } else {
        // 任务尚未开始处理或已完成处理
        setIsPaused(false);
        isPausedRef.current = false;
        setLastProcessedIndex(job.processedData.length - 1);
      }
      
      setShouldStop(false);
      shouldStopRef.current = false;
      setIsProcessing(false);
      
      // 切换到上传和处理标签页
      setActiveTabKey('upload');
      
      message.success('加载成功');
    }
  };

  // 根据处理进度获取进度条状态
  const getProgressStatus = () => {
    if (processingStatus.failed > 0) {
      return 'exception';
    }
    if (isPausedRef.current) {
      return 'normal';
    }
    if (processingStatus.isProcessing) {
      return 'active';
    }
    if (processingStatus.processedItems === processingStatus.totalItems) {
      return 'success';
    }
    return 'normal';
  };

  // 渲染Excel数据表格
  const renderDataTable = (data: ExcelItem[]) => {
    if (!data || data.length === 0) {
      return <Empty description="暂无数据" />;
    }

    // 收集所有可能的列名
    let allColumnKeys: string[] = [];
    
    // 首先添加原始表头
    allColumnKeys = [...headers];
    
    // 检查是否有结构化输出列，并添加到列列表中
    if (data && data.length > 0) {
      // 遍历所有处理过的数据行，收集所有可能的列名
      data.forEach((item) => {
        // 添加空值检查
        if (item) {
          Object.keys(item).forEach((key) => {
            // 排除内部使用的字段和已经存在的字段
            if (!key.startsWith('_') && !allColumnKeys.includes(key)) {
              allColumnKeys.push(key);
            }
          });
        }
      });
    }
    
    // 根据数据创建列配置
    const columns = allColumnKeys.map(key => {
      // 检测是否为结构化输出列（角色或内容）
      const isStructureColumn = key.includes(`${outputColumn}_角色`) || key.includes(`${outputColumn}_内容`);
      
      // 为结构化列设置不同的样式
      let columnConfig: any = {
        title: key,
        dataIndex: key,
        key: key,
        ellipsis: true,
      };
      
      // 如果是结构化列，添加特殊渲染
      if (isStructureColumn) {
        // 为角色列添加Tag形式展示
        if (key.includes(`${outputColumn}_角色`)) {
          columnConfig.render = (text: string) => (
            text ? <Tag color="blue">{text}</Tag> : null
          );
        }
        
        // 为内容列添加格式化展示
        if (key.includes(`${outputColumn}_内容`)) {
          columnConfig.render = (text: string) => (
            text ? 
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {text}
            </div> : null
          );
        }
      }
      
      // 如果是主输出列，允许展开查看完整内容
      if (key === outputColumn) {
        columnConfig.render = (text: string) => {
          if (!text) return null;
          
          // 检查是否为JSON格式
          try {
            JSON.parse(text);
            // 如果是JSON，用特殊样式显示
            return (
              <Tooltip title="JSON格式数据，已在其他列展开">
                <div style={{ maxHeight: '100px', overflow: 'auto', backgroundColor: '#f5f5f5', padding: '4px', borderRadius: '2px' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
                    {text}
                  </pre>
                </div>
              </Tooltip>
            );
          } catch (e) {
            // 不是JSON，正常显示
            return (
              <div style={{ maxHeight: '100px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {text}
              </div>
            );
          }
        };
      } else if (key.includes(`${outputColumn}_`)) {
        // 为数组类型的字段添加特殊渲染
        columnConfig.render = (text: string) => {
          if (!text) return null;
          
          // 如果是数组元素的单独列
          if (key.match(new RegExp(`${outputColumn}_.*_\\d+$`))) {
            return <Tag color="purple">{text}</Tag>;
          }
          
          // 检查是否为数组的字符串表示
          if (text.includes(', ') && !text.includes('{') && !text.includes('}')) {
            const items = text.split(', ');
            if (items.length > 0) {
              return (
                <div>
                  {items.map((item, i) => (
                    <Tag key={i} color="blue" style={{ margin: '2px' }}>
                      {item}
                    </Tag>
                  ))}
                </div>
              );
            }
          }
          
          return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>;
        };
      }
      
      return columnConfig;
    });

    // 确保有效的数据源
    const validDataSource = data
      .filter(item => item != null) // 过滤掉null和undefined
      .map(item => ({ 
        ...item, 
        key: item._rowId !== undefined ? item._rowId.toString() : Math.random().toString() 
      })); // 确保每项都有key

    // 对列进行排序，使结构化列排在输出列后面且按顺序排列
    columns.sort((a, b) => {
      // 安全检查
      if (!a || !b || !a.key || !b.key) return 0;
      
      // 原始输入列在前
      if (headers.includes(a.key) && !headers.includes(b.key)) return -1;
      if (!headers.includes(a.key) && headers.includes(b.key)) return 1;
      
      // 主输出列紧跟原始列
      if (a.key === outputColumn) return -1;
      if (b.key === outputColumn) return 1;
      
      // 角色列排在内容列前面
      if (a.key.includes(`${outputColumn}_角色`) && b.key.includes(`${outputColumn}_内容`)) {
        try {
          const aIndex = parseInt(a.key.replace(`${outputColumn}_角色`, ''), 10);
          const bIndex = parseInt(b.key.replace(`${outputColumn}_内容`, ''), 10);
          if (!isNaN(aIndex) && !isNaN(bIndex)) {
            return aIndex - bIndex;
          }
        } catch (e) {
          // 解析失败，忽略排序
          console.warn('角色-内容对比排序失败', e);
        }
      }
      
      // 按序号排序相同类型的列
      if (a.key.includes(`${outputColumn}_角色`) && b.key.includes(`${outputColumn}_角色`)) {
        try {
          const aIndex = parseInt(a.key.replace(`${outputColumn}_角色`, ''), 10);
          const bIndex = parseInt(b.key.replace(`${outputColumn}_角色`, ''), 10);
          if (!isNaN(aIndex) && !isNaN(bIndex)) {
            return aIndex - bIndex;
          }
        } catch (e) {
          // 解析失败，忽略排序
          console.warn('角色-角色排序失败', e);
        }
      }
      
      if (a.key.includes(`${outputColumn}_内容`) && b.key.includes(`${outputColumn}_内容`)) {
        try {
          const aIndex = parseInt(a.key.replace(`${outputColumn}_内容`, ''), 10);
          const bIndex = parseInt(b.key.replace(`${outputColumn}_内容`, ''), 10);
          if (!isNaN(aIndex) && !isNaN(bIndex)) {
            return aIndex - bIndex;
          }
        } catch (e) {
          // 解析失败，忽略排序
          console.warn('内容-内容排序失败', e);
        }
      }
      
      // 默认按列名排序
      return a.key.localeCompare(b.key);
    });

    return (
      <div>
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">
            共 {validDataSource.length} 行数据
            {validDataSource.some(item => item && '_hasStructuredOutput' in item) && (
              <Tag color="green" style={{ marginLeft: '8px' }}>
                包含结构化输出
              </Tag>
            )}
          </Text>
        </div>
        <Table
          dataSource={validDataSource}
          columns={columns}
          scroll={{ x: 'max-content', y: 400 }}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </div>
    );
  };

  // 处理预设切换
  const handlePresetChange = (preset: string) => {
    setProcessorPreset(preset);
    
    // 如果切换为预设，更新对应的预处理器状态
    if (preset === 'basic') {
      setTextProcessors({
        removeTimestamps: true,
        removeHtmlTags: false,
        normalizeWhitespace: true,
        removeDataMarkers: false,
        enhanceRoles: false
      });
    } else if (preset === 'complete') {
      setTextProcessors({
        removeTimestamps: true,
        removeHtmlTags: true,
        normalizeWhitespace: true,
        removeDataMarkers: false,
        enhanceRoles: false
      });
    } else if (preset === 'conversation') {
      setTextProcessors({
        removeTimestamps: true,
        removeHtmlTags: true,
        normalizeWhitespace: true,
        removeDataMarkers: false,
        enhanceRoles: true
      });
    }
  };

  // 添加使用feishuConfig的逻辑
  const handleFeishuConfigChange = (config: FeishuConfig) => {
    onFeishuConfigChange(config);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card title="Excel批处理">
        <Tabs 
          activeKey={activeTabKey} 
          onChange={handleTabChange}
        >
          <TabPane tab="上传和处理" key="upload">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Title level={5}>第一步：上传Excel文件</Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Upload
                    beforeUpload={handleFileUpload}
                    maxCount={1}
                    onRemove={() => {
                      setFile(null);
                      setExcelData([]);
                      setHeaders([]);
                    }}
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />}>选择Excel文件</Button>
                  </Upload>
                  {file && (
                    <>
                      <FileExcelOutlined style={{ color: '#52c41a' }} />
                      <Text strong>{file?.name || 'Unknown file'}</Text>
                      <Text type="secondary">({file?.size ? (file.size / 1024).toFixed(2) : '0'} KB)</Text>
                      <Button 
                        type="link" 
                        danger 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setExcelData([]);
                          setHeaders([]);
                        }}
                      >
                        删除
                      </Button>
                    </>
                  )}
                </div>
                {excelData.length > 0 && (
                  <Text type="success">
                    成功解析 {excelData.length} 行数据
                  </Text>
                )}
              </div>

              <div>
                <Title level={5}>第二步：配置处理参数</Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label>选择模型：</label>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="请选择模型"
                      value={selectedModel}
                      onChange={setSelectedModel}
                    >
                      {models
                        .sort((a, b) => {
                          // 免费模型排在前面
                          const aIsFree = a.tags?.includes('免费') || false;
                          const bIsFree = b.tags?.includes('免费') || false;
                          
                          if (aIsFree && !bIsFree) return -1;
                          if (!aIsFree && bIsFree) return 1;
                          
                          // 免费状态相同，按名称排序
                          return a.name.localeCompare(b.name);
                        })
                        .map(model => (
                          <Option key={model.id} value={model.id}>
                            {model.name} 
                            {model.tags?.includes('免费') && <Tag color="green" style={{ marginLeft: 4 }}>免费</Tag>}
                          </Option>
                        ))
                      }
                    </Select>
                  </div>

                  <div>
                    <label>选择提示词模板：</label>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="请选择提示词模板"
                      value={selectedTemplateId}
                      onChange={(value) => {
                        setSelectedTemplateId(value);
                        // 在这里直接更新提示词，而不是依赖useEffect
                        if (value) {
                          const template = promptTemplates.find(t => t.id === value);
                          if (template) {
                            setPrompt(template.prompt);
                          }
                        }
                      }}
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.children as unknown as string).toLowerCase().indexOf(input.toLowerCase()) >= 0
                      }
                      dropdownRender={menu => (
                        <div>
                          {menu}
                          <div style={{ padding: '8px', borderTop: '1px solid #e8e8e8' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              选择提示词模板可以快速应用预设的提示词
                            </Text>
                          </div>
                        </div>
                      )}
                    >
                      {promptTemplates.map(template => (
                        <Option key={template.id} value={template.id} title={template.description}>
                          {template.title}
                        </Option>
                      ))}
                    </Select>
                    {selectedTemplateId && (
                      <div style={{ marginTop: '5px' }}>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                          已选模板: {promptTemplates.find(t => t.id === selectedTemplateId)?.title}
                        </Text>
                        {promptTemplates.find(t => t.id === selectedTemplateId)?.description && (
                          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                            描述: {promptTemplates.find(t => t.id === selectedTemplateId)?.description}
                          </Text>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label>提示词：</label>
                    <Input.TextArea
                      placeholder="请输入提示词或从模板中选择"
                      value={prompt}
                      onChange={e => {
                        setPrompt(e.target.value);
                        // 如果手动修改了提示词，并且与当前选择的模板不一致，则清除模板选择
                        if (selectedTemplateId) {
                          const selectedTemplate = promptTemplates.find(template => template.id === selectedTemplateId);
                          if (selectedTemplate && e.target.value !== selectedTemplate.prompt) {
                            setSelectedTemplateId('');
                          }
                        }
                      }}
                      rows={3}
                    />
                    {selectedTemplateId && (
                      <div style={{ marginTop: '5px' }}>
                        <Button 
                          type="link" 
                          size="small"
                          onClick={() => {
                            setSelectedTemplateId('');
                            // 不需要清除提示词，因为用户可能已经手动修改过
                          }}
                        >
                          取消使用模板
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label>选择输入列：</label>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="请选择输入列"
                      value={inputColumn}
                      onChange={setInputColumn}
                      disabled={headers.length === 0}
                    >
                      {headers.map(header => (
                        <Option key={header} value={header}>
                          {header}
                        </Option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label>输出列名称：</label>
                    <Input
                      placeholder="请输入输出列名称"
                      value={outputColumn}
                      onChange={e => setOutputColumn(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Title level={5}>
                  <span>并行处理配置</span>
                  <Tooltip title="并行处理可以加快批处理速度，但过高的并发数可能导致请求失败或被API限流">
                    <InfoCircleOutlined style={{ marginLeft: 8, fontSize: 14 }} />
                  </Tooltip>
                </Title>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ marginRight: '12px', minWidth: '80px' }}>并发数量:</span>
                  <InputNumber
                    min={1}
                    max={maxConcurrency}
                    value={concurrency}
                    onChange={handleConcurrencyChange}
                    style={{ width: '80px', marginRight: '12px' }}
                  />
                  <Slider
                    min={1}
                    max={maxConcurrency}
                    value={concurrency}
                    onChange={handleConcurrencyChange}
                    style={{ flex: 1, marginRight: '12px' }}
                    disabled={false}  // 允许随时调整
                  />
                  <Tooltip title="设置并发处理的上限">
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      最大值: 
                      <InputNumber
                        min={5}
                        max={100}
                        value={maxConcurrency}
                        onChange={(value) => value && setMaxConcurrency(value)}
                        style={{ width: '80px', marginLeft: '8px' }}
                      />
                    </span>
                  </Tooltip>
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <ThunderboltOutlined style={{ marginRight: '4px' }} />
                  并发数越高处理速度越快，但会增加API调用失败的风险或可能触发API限流
                  {isProcessing && <span style={{ color: '#3b82f6', marginLeft: '8px' }}>可以在处理过程中调整并发数</span>}
                </Text>
              </div>

              <div>
                <Title level={5}>
                  <span>文本预处理</span>
                  <Tooltip title="在处理前对输入文本进行清理和格式化，提高处理质量">
                    <FilterOutlined style={{ marginLeft: 8, fontSize: 14 }} />
                  </Tooltip>
                </Title>
                
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <Switch 
                    checked={enableTextProcessing}
                    onChange={setEnableTextProcessing}
                    style={{ marginRight: '12px' }}
                  />
                  <Text>启用文本预处理</Text>
                </div>
                
                {enableTextProcessing && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <Text style={{ marginRight: '12px' }}>选择预设:</Text>
                      <Select 
                        value={processorPreset} 
                        onChange={handlePresetChange}
                        style={{ width: '200px' }}
                      >
                        <Option value="custom">自定义设置</Option>
                        <Option value="basic">基础清理 (时间戳+空白字符)</Option>
                        <Option value="complete">完整清理 (时间戳+HTML+空白字符)</Option>
                        <Option value="conversation">对话处理</Option>
                      </Select>
                    </div>
                    
                    {processorPreset === 'conversation' && (
                      <div style={{ marginBottom: '12px' }}>
                        <Text>角色映射配置:</Text>
                        <Input.TextArea
                          value={speakerMap}
                          onChange={e => setSpeakerMap(e.target.value)}
                          placeholder='{"司机": "司机", "用户": "用户", "乘客": "用户"}'
                          rows={4}
                          style={{ marginTop: '8px', fontFamily: 'monospace' }}
                        />
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                          JSON格式，用于将原文中的角色名映射为标准角色名
                        </Text>
                      </div>
                    )}
                    
                    {processorPreset === 'custom' && (
                      <Collapse bordered={false} defaultActiveKey={['1']}>
                        <Panel header="自定义预处理选项" key="1">
                          <div style={{ marginBottom: '8px' }}>
                            <Checkbox 
                              checked={textProcessors.removeTimestamps}
                              onChange={e => setTextProcessors({
                                ...textProcessors,
                                removeTimestamps: e.target.checked
                              })}
                            >
                              <Space>
                                <Text>去除时间戳</Text>
                                <ClockCircleOutlined />
                                <Text type="secondary">[00::00::00-00::00::00]</Text>
                              </Space>
                            </Checkbox>
                          </div>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Checkbox 
                              checked={textProcessors.removeHtmlTags}
                              onChange={e => setTextProcessors({
                                ...textProcessors,
                                removeHtmlTags: e.target.checked
                              })}
                            >
                              <Space>
                                <Text>去除HTML标签</Text>
                                <FormOutlined />
                                <Text type="secondary">&lt;tag&gt;内容&lt;/tag&gt;</Text>
                              </Space>
                            </Checkbox>
                          </div>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Checkbox 
                              checked={textProcessors.normalizeWhitespace}
                              onChange={e => setTextProcessors({
                                ...textProcessors,
                                normalizeWhitespace: e.target.checked
                              })}
                            >
                              <Space>
                                <Text>规范化空白字符</Text>
                                <EditOutlined />
                                <Text type="secondary">删除多余空格和换行</Text>
                              </Space>
                            </Checkbox>
                          </div>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Checkbox 
                              checked={textProcessors.removeDataMarkers}
                              onChange={e => setTextProcessors({
                                ...textProcessors,
                                removeDataMarkers: e.target.checked
                              })}
                            >
                              <Space>
                                <Text>去除自定义标记</Text>
                                <FilterOutlined />
                              </Space>
                            </Checkbox>
                          </div>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Checkbox 
                              checked={textProcessors.enhanceRoles}
                              onChange={e => setTextProcessors({
                                ...textProcessors,
                                enhanceRoles: e.target.checked
                              })}
                            >
                              <Space>
                                <Text>角色增强</Text>
                                <TeamOutlined />
                                <Text type="secondary">转换为结构化对话</Text>
                              </Space>
                            </Checkbox>
                          </div>
                          
                          {textProcessors.removeDataMarkers && (
                            <div style={{ marginTop: '8px' }}>
                              <Text>自定义正则表达式（每行一个）：</Text>
                              <Input.TextArea
                                value={customPatterns}
                                onChange={e => setCustomPatterns(e.target.value)}
                                placeholder="输入要去除的模式，如 \[\d+\] 或 \<DATA\>"
                                rows={3}
                                style={{ marginTop: '8px' }}
                              />
                              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                                每行输入一个正则表达式模式，匹配的内容将被删除
                              </Text>
                            </div>
                          )}
                          
                          {textProcessors.enhanceRoles && (
                            <div style={{ marginTop: '8px' }}>
                              <Text>角色映射配置:</Text>
                              <Input.TextArea
                                value={speakerMap}
                                onChange={e => setSpeakerMap(e.target.value)}
                                placeholder='{"司机": "司机", "用户": "用户", "乘客": "用户"}'
                                rows={4}
                                style={{ marginTop: '8px', fontFamily: 'monospace' }}
                              />
                              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                                JSON格式，用于将原文中的角色名映射为标准角色名
                              </Text>
                            </div>
                          )}
                        </Panel>
                      </Collapse>
                    )}
                    
                    <div style={{ marginTop: '8px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        <FilterOutlined style={{ marginRight: '4px' }} />
                        预处理可以清理文本中的无用内容，提高模型处理质量
                      </Text>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px' }}>
                <Title level={5}>第三步：开始处理</Title>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {(!isProcessing && !isPaused) ? (
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => startProcessing(0)}
                      disabled={!excelData.length || !selectedModel || !prompt.trim() || !inputColumn}
                    >
                      开始处理 ({concurrency}并发)
                    </Button>
                  ) : isPaused ? (
                    <>
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={resumeProcessing}
                      >
                        继续处理
                      </Button>
                      <Button
                        danger
                        icon={<StopOutlined />}
                        onClick={stopProcessing}
                      >
                        终止
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        icon={<PauseCircleOutlined />}
                        onClick={pauseProcessing}
                      >
                        暂停
                      </Button>
                      <Button
                        danger
                        icon={<StopOutlined />}
                        onClick={stopProcessing}
                      >
                        终止
                      </Button>
                    </>
                  )}
                  <Button
                    icon={<ExportOutlined />}
                    onClick={exportToExcel}
                    disabled={!currentBatchJob?.processedData.length}
                  >
                    导出结果
                  </Button>
                  <Button
                    icon={<FileAddOutlined />}
                    onClick={handleSaveJob}
                    disabled={!currentBatchJob || isProcessing}
                  >
                    保存任务
                  </Button>
                </div>

                {processingStatus.totalItems > 0 && (
                  <div>
                    <Title level={5}>处理进度</Title>
                    <Progress
                      percent={Math.round((processingStatus.processedItems / processingStatus.totalItems) * 100)}
                      status={getProgressStatus()}
                    />
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Text>
                          总计: {processingStatus.totalItems} | 
                          已处理: {processingStatus.processedItems} | 
                          成功: {processingStatus.success} | 
                          失败: {processingStatus.failed}
                        </Text>
                      </div>
                      {isProcessing && (
                        <Tag color="blue" icon={<ThunderboltOutlined />}>
                          {concurrency}并发处理中
                        </Tag>
                      )}
                      {isPaused && !isProcessing && lastProcessedIndex >= 0 && (
                        <Tag color="orange">已暂停</Tag>
                      )}
                      {!isProcessing && !isPaused && processingStatus.processedItems > 0 && 
                       processingStatus.processedItems === processingStatus.totalItems && (
                        <Tag color="success" icon={<CheckCircleOutlined />}>处理完成</Tag>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabPane>

          <TabPane tab="处理结果" key="results">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={5}>
                  {currentBatchJob?.processedData && currentBatchJob.processedData.length > 0 ? 
                   `处理结果 (${currentBatchJob.processedData.length}/${currentBatchJob.originalData.length} 行)` : 
                   '输出结果'}
                </Title>
                <Space>
                  {isPausedRef.current && !isProcessing && (
                    <Text type="warning">处理已暂停，显示当前已处理的结果</Text>
                  )}
                  <Button
                    icon={<ExportOutlined />}
                    onClick={exportToExcel}
                    disabled={!currentBatchJob?.processedData.length}
                  >
                    导出结果
                  </Button>
                </Space>
              </div>
              
              {isProcessing ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin tip="正在处理中..." />
                </div>
              ) : (
                renderDataTable(currentBatchJob?.processedData || [])
              )}
            </div>
          </TabPane>

          <TabPane tab="原始数据" key="original">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Title level={5}>原始数据</Title>
              {renderDataTable(excelData)}
            </div>
          </TabPane>

          <TabPane tab="已保存任务" key="saved">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Title level={5}>已保存的批处理任务</Title>
              {savedBatchJobs.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={savedBatchJobs}
                  renderItem={job => (
                    <List.Item
                      actions={[
                        <Button
                          key="load"
                          type="link"
                          onClick={() => loadBatchJob(job.id)}
                        >
                          加载
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <span>{job.title}</span>
                            {job.processedData.length === job.originalData.length ? (
                              <Text type="success" style={{ fontSize: '12px' }}>已完成</Text>
                            ) : job.processedData.length > 0 ? (
                              <Text type="warning" style={{ fontSize: '12px' }}>已处理 {job.processedData.length}/{job.originalData.length}</Text>
                            ) : (
                              <Text type="secondary" style={{ fontSize: '12px' }}>未开始</Text>
                            )}
                          </Space>
                        }
                        description={
                          <div>
                            <Space direction="vertical" size={0}>
                              <Text type="secondary">
                                创建时间: {new Date(job.timestamp).toLocaleString()}
                              </Text>
                              <Text type="secondary">
                                模型: {models.find(m => m.id === job.modelId)?.name || '未知模型'}
                              </Text>
                              <Progress 
                                percent={Math.round((job.processedData.length / job.originalData.length) * 100)} 
                                size="small"
                                status={
                                  job.processedData.length === job.originalData.length 
                                    ? 'success'
                                    : job.processedData.length > 0 
                                      ? 'active' 
                                      : 'normal'
                                }
                              />
                            </Space>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无保存的任务" />
              )}
            </div>
          </TabPane>

          <TabPane tab="飞书通知配置" key="feishu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Title level={5}>飞书通知配置</Title>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <Switch 
                  checked={currentBatchJob?.notifyOnComplete || feishuConfig.enabled}
                  onChange={(checked) => {
                    // 同时更新本地批处理任务和全局配置
                    if (currentBatchJob) {
                      setCurrentBatchJob((prev: BatchJob | null) => {
                        if (!prev) return null;
                        return {
                          ...prev,
                          notifyOnComplete: checked
                        };
                      });
                    }
                    
                    // 更新全局配置
                    handleFeishuConfigChange({
                      ...feishuConfig,
                      enabled: checked
                    });
                  }}
                  style={{ marginRight: '12px' }}
                />
                <Text>批处理完成后发送飞书通知</Text>
              </div>
              
              {(currentBatchJob?.notifyOnComplete || feishuConfig.enabled) && (
                <Alert
                  message="使用全局系统通知配置"
                  description={
                    <Space direction="vertical">
                      <Text>
                        当前使用系统全局通知配置，您可以在"系统通知配置"菜单中修改详细设置。
                      </Text>
                      <Button 
                        type="primary" 
                        size="small"
                        icon={<SendOutlined />}
                        onClick={() => {
                          // 在当前任务中保存配置引用
                          if (currentBatchJob) {
                            setCurrentBatchJob((prev: BatchJob | null) => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                feishuConfig: feishuConfig,
                                notifyOnComplete: feishuConfig.enabled
                              };
                            });
                          }
                        }}
                      >
                        应用系统配置
                      </Button>
                    </Space>
                  }
                  type="info"
                  showIcon
                />
              )}
            </div>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="保存批处理任务"
        open={saveJobModalVisible}
        onOk={confirmSaveJob}
        onCancel={() => setSaveJobModalVisible(false)}
      >
        <Input
          placeholder="请输入任务标题"
          value={jobTitle}
          onChange={e => setJobTitle(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default BatchProcessing; 