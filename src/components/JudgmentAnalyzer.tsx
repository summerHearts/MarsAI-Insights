import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Button, Select, Card, Table, Space, Typography, message, 
  Spin, Divider, Alert, Radio, Collapse, Input, Switch, Tooltip, Tag, Progress,
  Statistic, InputNumber
} from 'antd';
import { 
  UploadOutlined, 
  FileExcelOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  QuestionCircleOutlined,
  WarningOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
import type { UploadChangeParam } from 'antd/es/upload';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { callModel } from '../services/api';
import { Model } from '../types';

// 导入自定义类型
interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  description?: string;
}

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TextArea } = Input;

// 分析状态类型
type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'error';

// 分析结果类型
interface AnalysisResult {
  id: string;
  originalText: string;
  analysisResult: string;
  isReasonable: boolean | null; // true表示合理，false表示不合理，null表示需要人工判断
  confidence: number; // 0-100
  explanation: string;
}

interface JudgmentAnalyzerProps {
  models: Model[];
  promptTemplates: PromptTemplate[];
}

const JudgmentAnalyzer: React.FC<JudgmentAnalyzerProps> = ({ models, promptTemplates }) => {
  // 文件和数据状态
  const [file, setFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedJudgmentColumn, setSelectedJudgmentColumn] = useState<string>('');
  const [selectedEvidenceColumn, setSelectedEvidenceColumn] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // 模型和提示词状态
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>(
    '你是一个专业的大模型判责结果评估专家。你需要评估以下由大模型做出的判责结果是否合理。\n\n' +
    '我会给你两部分内容：\n' +
    '1. 判责结果：大模型给出的判责结论\n' +
    '2. 命中依据：支持该判责结论的证据\n\n' +
    '请根据判责结果和命中依据的对应关系，分析判责结果是否合理。需要考虑：\n' +
    '1. 判责结果是否与命中依据相符\n' +
    '2. 命中依据是否充分支持判责结果\n' +
    '3. 是否存在逻辑矛盾或不合理之处\n\n' +
    '请按照以下格式输出你的分析结果：\n' +
    '结论：[合理/不合理/需人工判断]\n' +
    '置信度：[0-100]\n' +
    '分析：[详细分析理由，需要重点说明判责结果与命中依据的对应关系]'
  );
  
  // 分析状态和结果
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [statistics, setStatistics] = useState<{
    total: number;
    reasonable: number;
    unreasonable: number;
    manual: number;
  }>({ total: 0, reasonable: 0, unreasonable: 0, manual: 0 });
  
  // 开关状态
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(5);
  const [batchDelay, setBatchDelay] = useState<number>(1000);
  
  // 添加任务控制相关的状态和引用
  const shouldStopRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const lastProcessedIndexRef = useRef<number>(0);
  
  // 当组件卸载或切换tab时，自动取消任务
  useEffect(() => {
    return () => {
      // 组件卸载时标记任务应该停止
      if (analysisStatus === 'analyzing') {
        shouldStopRef.current = true;
        message.info('任务已在后台取消');
      }
    };
  }, [analysisStatus]);
  
  // 检查文件是否为Excel
  const isExcelFile = (file: RcFile): boolean => {
    const isExcelType = 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.type === 'application/vnd.ms-excel';
    const isExcelExt = /\.(xlsx|xls)$/i.test(file.name);
    
    return isExcelType || isExcelExt;
  };

  // 将FileReader封装为Promise
  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target && e.target.result) {
          resolve(e.target.result as ArrayBuffer);
        } else {
          reject(new Error('读取文件失败，结果为空'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error(`读取文件出错: ${reader.error?.message || '未知错误'}`));
      };
      
      try {
        reader.readAsArrayBuffer(file);
      } catch (error) {
        reject(error);
      }
    });
  };

  // 处理文件上传前的验证
  const handleBeforeUpload = (file: RcFile) => {
    const isExcelType = isExcelFile(file);
    
    if (!isExcelType) {
      message.error('只能上传 Excel 文件(.xlsx, .xls)');
      return Upload.LIST_IGNORE;
    }
    
    // 直接在这里处理文件
    handleExcelFile(file);
    
    return false; // 阻止自动上传
  };

  // 处理Excel文件
  const handleExcelFile = async (excelFile: RcFile) => {
    // 清除之前的数据
    setExcelData([]);
    setColumns([]);
    setSelectedJudgmentColumn('');
    setSelectedEvidenceColumn('');
    setAnalysisResults([]);
    setStatistics({ total: 0, reasonable: 0, unreasonable: 0, manual: 0 });
    setProgress(0);
    setAnalysisStatus('idle');
    
    setLoading(true);
    setFile(excelFile);
    
    try {
      const data = await readFileAsArrayBuffer(excelFile);
      
      // 读取Excel工作簿
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        message.error('Excel文件不包含任何工作表');
        setLoading(false);
        return;
      }
      
      // 获取第一个工作表
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // 将工作表转换为JSON
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      if (jsonData.length === 0) {
        message.warning('上传的Excel文件不包含任何数据');
        setLoading(false);
        return;
      }
      
      setExcelData(jsonData as any[]);
      
      // 获取所有列名
      const columnNames = Object.keys(jsonData[0] as object);
      setColumns(columnNames);
      
      message.success('文件上传成功！');
    } catch (error) {
      console.error('Excel解析错误:', error);
      message.error('Excel文件解析失败，请确保文件格式正确');
    } finally {
      setLoading(false);
    }
  };

  // 处理列选择
  const handleJudgmentColumnSelect = (value: string) => {
    setSelectedJudgmentColumn(value);
  };

  const handleEvidenceColumnSelect = (value: string) => {
    setSelectedEvidenceColumn(value);
  };

  // 处理模型选择
  const handleModelSelect = (value: string) => {
    setSelectedModelId(value);
  };

  // 处理提示词模板选择
  const handlePromptTemplateSelect = (value: string) => {
    const template = promptTemplates.find(t => t.id === value);
    if (template) {
      setCustomPrompt(template.prompt);
    }
  };

  // 开始分析
  const startAnalysis = async () => {
    if (!selectedJudgmentColumn) {
      message.error('请选择要分析的结果列');
      return;
    }

    if (!selectedEvidenceColumn) {
      message.error('请选择命中依据列');
      return;
    }

    if (!selectedModelId) {
      message.error('请选择要使用的模型');
      return;
    }

    const selectedModel = models.find(m => m.id === selectedModelId);
    if (!selectedModel) {
      message.error('所选模型不存在');
      return;
    }

    if (!customPrompt.trim()) {
      message.error('请输入分析提示词');
      return;
    }

    // 重置任务控制状态
    shouldStopRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    lastProcessedIndexRef.current = 0;
    
    setAnalysisStatus('analyzing');
    setProgress(0);
    setAnalysisResults([]);
    setStatistics({ total: 0, reasonable: 0, unreasonable: 0, manual: 0 });

    try {
      let processedCount = 0;
      let reasonableCount = 0;
      let unreasonableCount = 0;
      let manualCount = 0;
      const totalCount = excelData.length;
      const results: AnalysisResult[] = [];

      // 使用批处理方式处理数据
      for (let i = 0; i < excelData.length; i += batchSize) {
        // 检查是否应该停止任务
        if (shouldStopRef.current) {
          message.info('已终止分析任务');
          break;
        }
        
        // 检查是否暂停
        while (isPausedRef.current) {
          // 等待恢复
          await new Promise(resolve => setTimeout(resolve, 500));
          // 如果在暂停期间被终止，则退出
          if (shouldStopRef.current) {
            break;
          }
        }
        
        // 如果在暂停后收到终止信号，则退出循环
        if (shouldStopRef.current) {
          message.info('已终止分析任务');
          break;
        }
        
        lastProcessedIndexRef.current = i;
        const batch = excelData.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (item) => {
          const judgmentText = item[selectedJudgmentColumn]?.toString() || '';
          const evidenceText = item[selectedEvidenceColumn]?.toString() || '';
          
          if (!judgmentText.trim()) {
            return {
              id: uuidv4(),
              originalText: judgmentText,
              analysisResult: '判责内容为空，无法分析',
              isReasonable: null,
              confidence: 0,
              explanation: '原始判责内容为空，不进行分析'
            };
          }
          
          try {
            // 在每个请求之前检查是否已停止
            if (shouldStopRef.current) {
              throw new Error('任务已终止');
            }
            
            const input = `待分析的判责结果：${judgmentText}\n命中依据：${evidenceText}`;
            const response = await callModel(selectedModel, customPrompt, input, {
              temperature: 0.3,
            });
            
            const analysisText = response.content;
            
            // 解析输出结果
            let isReasonable: boolean | null = null;
            let confidence = 0;
            let explanation = '';
            
            // 尝试解析结论和置信度
            const conclusionMatch = analysisText.match(/结论：(合理|不合理|需人工判断)/);
            const confidenceMatch = analysisText.match(/置信度：(\d+)/);
            const analysisMatch = analysisText.match(/分析：([\s\S]+?)(?=\n\n|$)/);
            
            if (conclusionMatch) {
              const conclusion = conclusionMatch[1];
              if (conclusion === '合理') {
                isReasonable = true;
                reasonableCount++;
              } else if (conclusion === '不合理') {
                isReasonable = false;
                unreasonableCount++;
              } else if (conclusion === '需人工判断') {
                isReasonable = null;
                manualCount++;
              }
            }
            
            if (confidenceMatch) {
              confidence = parseInt(confidenceMatch[1], 10);
              confidence = Math.max(0, Math.min(100, confidence)); // 确保在0-100范围内
            }
            
            if (analysisMatch) {
              explanation = analysisMatch[1].trim();
            } else {
              explanation = analysisText;
            }
            
            return {
              id: uuidv4(),
              originalText: judgmentText,
              analysisResult: analysisText,
              isReasonable,
              confidence,
              explanation
            };
          } catch (error) {
            console.error('分析时出错:', error);
            return {
              id: uuidv4(),
              originalText: judgmentText,
              analysisResult: `分析错误: ${error instanceof Error ? error.message : '未知错误'}`,
              isReasonable: null,
              confidence: 0,
              explanation: '处理过程中出错'
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        processedCount += batchResults.length;
        setProgress(Math.floor((processedCount / totalCount) * 100));
        setAnalysisResults([...results]);
        
        // 更新统计数据
        setStatistics({
          total: processedCount,
          reasonable: reasonableCount,
          unreasonable: unreasonableCount,
          manual: manualCount
        });
        
        // 添加延迟，避免API限流
        if (i + batchSize < excelData.length && !shouldStopRef.current && !isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
      
      // 如果任务被终止，保持 analyzing 状态，以便用户可以恢复
      if (shouldStopRef.current) {
        setAnalysisStatus('idle');
      } else {
        setAnalysisStatus('completed');
        message.success('分析完成');
      }
    } catch (error) {
      console.error('分析过程中出错:', error);
      setAnalysisStatus('error');
      message.error('分析过程中出错，请重试');
    }
  };
  
  // 暂停/恢复分析
  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(!isPaused);
    if (isPausedRef.current) {
      message.info('分析已暂停，点击恢复按钮继续');
    } else {
      message.info('分析已恢复');
    }
  };
  
  // 终止分析
  const stopAnalysis = () => {
    shouldStopRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    message.info('正在终止分析，请稍等...');
  };
  
  // 从上次中断处恢复分析
  const resumeAnalysis = () => {
    if (analysisStatus !== 'idle' && analysisStatus !== 'error') {
      message.error('当前状态无法恢复分析');
      return;
    }
    
    // 重置任务控制状态
    shouldStopRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    
    // 从上次处理的位置开始
    const startIndex = lastProcessedIndexRef.current + batchSize;
    if (startIndex >= excelData.length) {
      message.info('已经处理完所有数据');
      return;
    }
    
    setAnalysisStatus('analyzing');
    startAnalysis();
  };

  // 导出分析结果
  const exportResults = () => {
    if (analysisResults.length === 0) {
      message.warning('没有可导出的结果');
      return;
    }

    // 将结果转换为Excel可用的格式
    const exportData = analysisResults.map(result => ({
      '原始内容': result.originalText,
      '分析结果': result.isReasonable === true ? '合理' : (result.isReasonable === false ? '不合理' : '需人工判断'),
      '置信度': result.confidence,
      '详细分析': result.explanation
    }));

    // 创建工作簿和工作表
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, '判责分析结果');

    // 保存为Excel文件
    XLSX.writeFile(wb, `判责分析结果_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('导出成功');
  };

  // 表格列定义
  const tableColumns = [
    {
      title: '原始判责内容',
      dataIndex: 'originalText',
      key: 'originalText',
      width: '40%',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <div style={{ maxHeight: '100px', overflow: 'auto' }}>{text}</div>
        </Tooltip>
      )
    },
    {
      title: '分析结果',
      dataIndex: 'isReasonable',
      key: 'isReasonable',
      width: '15%',
      render: (isReasonable: boolean | null) => {
        if (isReasonable === true) {
          return <Tag color="success" icon={<CheckCircleOutlined />}>合理</Tag>;
        } else if (isReasonable === false) {
          return <Tag color="error" icon={<CloseCircleOutlined />}>不合理</Tag>;
        } else {
          return <Tag color="warning" icon={<QuestionCircleOutlined />}>需人工判断</Tag>;
        }
      }
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: '15%',
      render: (confidence: number) => {
        let color = 'green';
        if (confidence < 40) {
          color = 'red';
        } else if (confidence < 70) {
          color = 'orange';
        }
        return <Progress percent={confidence} size="small" strokeColor={color} />;
      }
    },
    {
      title: '分析说明',
      dataIndex: 'explanation',
      key: 'explanation',
      width: '30%',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <div style={{ maxHeight: '100px', overflow: 'auto' }}>{text}</div>
        </Tooltip>
      )
    }
  ];

  return (
    <div className="judgment-analyzer">
      <div className="upload-section">
        <Card title="第一步：上传数据文件" bordered={false}>
          <Upload
            accept=".xlsx,.xls"
            beforeUpload={handleBeforeUpload}
            maxCount={1}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />} loading={loading} type="primary">
              选择Excel文件
            </Button>
          </Upload>
          
          {file && (
            <div style={{ marginTop: '10px' }}>
              <Text type="secondary">已上传: </Text>
              <Text strong>{file.name}</Text> ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </Card>
      </div>
      
      {excelData.length > 0 && (
        <div className="config-section" style={{ marginTop: '20px' }}>
          <Card title="第二步：配置分析参数" bordered={false}>
            <div style={{ marginBottom: '15px' }}>
              <Text strong>选择要分析的结果列：</Text>
              <Select
                placeholder="选择结果列"
                style={{ width: '100%', marginTop: '8px' }}
                onChange={handleJudgmentColumnSelect}
                value={selectedJudgmentColumn}
              >
                {columns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <Text strong>选择命中依据列：</Text>
              <Select
                placeholder="选择命中依据列"
                style={{ width: '100%', marginTop: '8px' }}
                onChange={handleEvidenceColumnSelect}
                value={selectedEvidenceColumn}
              >
                {columns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </div>
            
            <Divider />
            
            <div style={{ marginBottom: '15px' }}>
              <Text strong>选择分析模型：</Text>
              <Select
                placeholder="选择模型"
                style={{ width: '100%', marginTop: '8px' }}
                onChange={handleModelSelect}
                value={selectedModelId}
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
            
            <Divider />
            
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>分析提示词：</Text>
                <Select
                  placeholder="选择提示词模板"
                  style={{ width: '40%' }}
                  onChange={handlePromptTemplateSelect}
                  allowClear
                >
                  {promptTemplates.map(template => (
                    <Option key={template.id} value={template.id}>{template.title}</Option>
                  ))}
                </Select>
              </div>
              <TextArea
                rows={6}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                style={{ marginTop: '8px' }}
              />
            </div>
            
            <Collapse ghost>
              <Panel header="高级设置" key="advanced">
                <div style={{ marginBottom: '10px' }}>
                  <Text>批处理大小：</Text>
                  <InputNumber
                    min={1}
                    max={20}
                    value={batchSize}
                    onChange={value => setBatchSize(value as number)}
                  />
                  <Text type="secondary" style={{ marginLeft: '10px' }}>
                    每批处理的数据量，较大的值可能导致API限流
                  </Text>
                </div>
                
                <div>
                  <Text>批处理间隔 (毫秒)：</Text>
                  <InputNumber
                    min={0}
                    max={10000}
                    step={100}
                    value={batchDelay}
                    onChange={value => setBatchDelay(value as number)}
                  />
                  <Text type="secondary" style={{ marginLeft: '10px' }}>
                    批处理之间的等待时间，增加可以避免API限流
                  </Text>
                </div>
              </Panel>
            </Collapse>
            
            <div style={{ marginTop: '15px', textAlign: 'center' }}>
              {analysisStatus === 'idle' && (
                <Button 
                  type="primary" 
                  onClick={startAnalysis}
                  disabled={!selectedJudgmentColumn || !selectedEvidenceColumn || !selectedModelId}
                  icon={<FileExcelOutlined />}
                  size="large"
                >
                  开始分析
                </Button>
              )}
              {analysisStatus === 'error' && (
                <Button 
                  type="primary" 
                  onClick={resumeAnalysis}
                  icon={<PlayCircleOutlined />}
                  size="large"
                >
                  恢复分析
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
      
      {analysisStatus !== 'idle' && (
        <div className="result-section" style={{ marginTop: '20px' }}>
          <Card 
            title="第三步：分析结果" 
            bordered={false}
            extra={
              <>
                {analysisStatus === 'analyzing' && (
                  <Space>
                    <Button 
                      icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />} 
                      onClick={togglePause}
                    >
                      {isPaused ? '恢复' : '暂停'}
                    </Button>
                    <Button 
                      danger 
                      icon={<StopOutlined />} 
                      onClick={stopAnalysis}
                    >
                      终止
                    </Button>
                  </Space>
                )}
                {analysisStatus === 'completed' && (
                  <Button type="primary" onClick={exportResults}>
                    导出结果
                  </Button>
                )}
              </>
            }
          >
            {analysisStatus === 'analyzing' && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip={isPaused ? "分析已暂停..." : "正在分析中..."} spinning={!isPaused} />
                <div style={{ marginTop: '15px' }}>
                  <Progress percent={progress} status={isPaused ? "exception" : "active"} />
                  <Text>{`已处理 ${statistics.total} / ${excelData.length} 条数据`}</Text>
                </div>
              </div>
            )}
            
            {analysisStatus === 'error' && (
              <Alert
                message="分析过程中出错"
                description="处理数据时发生错误，请检查网络连接和API配置后重试。"
                type="error"
                showIcon
              />
            )}
            
            {analysisStatus === 'completed' && (
              <>
                <div className="statistics" style={{ marginBottom: '20px' }}>
                  <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      <Statistic 
                        title="总分析数量" 
                        value={statistics.total} 
                        suffix={`/${excelData.length}`}
                      />
                      <Statistic 
                        title="判断合理" 
                        value={statistics.reasonable} 
                        valueStyle={{ color: '#3f8600' }}
                        suffix={`(${((statistics.reasonable / statistics.total) * 100).toFixed(1)}%)`}
                      />
                      <Statistic 
                        title="判断不合理" 
                        value={statistics.unreasonable} 
                        valueStyle={{ color: '#cf1322' }}
                        suffix={`(${((statistics.unreasonable / statistics.total) * 100).toFixed(1)}%)`}
                      />
                      <Statistic 
                        title="需人工判断" 
                        value={statistics.manual} 
                        valueStyle={{ color: '#faad14' }}
                        suffix={`(${((statistics.manual / statistics.total) * 100).toFixed(1)}%)`}
                      />
                    </div>
                  </Card>
                </div>
                
                <Table
                  columns={tableColumns}
                  dataSource={analysisResults}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000, y: 500 }}
                />
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default JudgmentAnalyzer; 