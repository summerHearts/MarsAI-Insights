import React, { useState } from 'react';
import { 
  Card, 
  Select, 
  Button, 
  Input, 
  Spin, 
  Empty, 
  Divider, 
  Typography, 
  Collapse,
  Upload,
  message,
  Tooltip,
  Tabs
} from 'antd';
import { 
  BarChartOutlined, 
  UploadOutlined,
  FileExcelOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { UploadFile } from 'antd/lib/upload/interface';
import { Model, ExcelItem } from '../types';
import { callModel } from '../services/api';
import ReactECharts from 'echarts-for-react';
import { excelToJson, getHeaders } from '../utils/excelHelpers';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

// 定义图表颜色方案常量
const COLOR_SCHEMES = [
  ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
  ['#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6'],
  ['#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6', '#91cc75'],
  ['#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6', '#91cc75', '#fac858'],
  ['#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6', '#91cc75', '#fac858', '#ee6666'],
  ['#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de']
];

interface ChartAnalyzerProps {
  models: Model[];
}

const ChartAnalyzer: React.FC<ChartAnalyzerProps> = ({ models }) => {
  // 文件和数据状态
  const [file, setFile] = useState<UploadFile | null>(null);
  const [excelData, setExcelData] = useState<ExcelItem[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // 图表分析相关状态
  const [selectedDataColumns, setSelectedDataColumns] = useState<string[]>([]);
  const [chartModelId, setChartModelId] = useState<string>('');
  const [chartPrompt, setChartPrompt] = useState<string>('');
  const [isGeneratingChart, setIsGeneratingChart] = useState<boolean>(false);
  const [chartOption, setChartOption] = useState<any>(null);
  const [chartOptions, setChartOptions] = useState<any[]>([]);  // 存储多个图表配置
  const [chartError, setChartError] = useState<string>('');
  const [chartDescription, setChartDescription] = useState<string>('');
  const [selectedChartTemplate, setSelectedChartTemplate] = useState<string>('');
  const [chartTemplates] = useState<{id: string, name: string, prompt: string}[]>([
    {
      id: 'template-1',
      name: '基础数据统计分析',
      prompt: '根据以下表格数据进行基础统计分析并生成图表。表格数据中包含用户选择的多个列，请为每个数据列生成一个单独的图表，并额外生成一个展示所有列关系的综合图表。请输出多个JSON，每个JSON对应一个echarts的完整配置项，格式为{title:{text:"列名-分析类型"},tooltip:{},legend:{},xAxis:{},yAxis:{},series:[]}。每个图表配置需确保有明确的标题、坐标轴标签等元素。注意：请不要在JSON中使用JavaScript函数，使用字符串或固定值代替。同时提供一段对所有数据的综合分析文字。表格数据：'
    },
    {
      id: 'template-2',
      name: '数据分布分析',
      prompt: '请分析以下表格数据中各选定列的分布情况，为每个选定的数据列生成一个饼图或柱状图，再额外生成一个包含所有列的综合对比图表。输出多个JSON格式的echarts配置项，每个对应一个图表。确保配置完整，图表美观，并增加适当的颜色和动画效果。每个JSON的title需要包含对应的列名，以便区分不同列的图表。注意：请不要在JSON中使用JavaScript函数，使用固定颜色数组代替函数。同时简要解释每个列的数据分布特点和整体分布规律。表格数据：'
    },
    {
      id: 'template-3',
      name: '趋势分析',
      prompt: '请分析以下表格数据中各选定列的趋势变化，首先生成一个包含所有列的多曲线折线图或面积图用于对比分析，然后为每个数据列单独生成一个趋势图以展示其详细变化。输出多个JSON格式的echarts配置项，包含完整的title、tooltip、legend、xAxis、yAxis和series配置。请确保图表清晰展示数据趋势，并使用不同颜色区分不同数据列。注意：请不要在JSON中使用JavaScript函数，使用固定值或数组代替。同时分析各数据列的趋势特点和相互关系。表格数据：'
    },
    {
      id: 'template-4',
      name: '各维度分析',
      prompt: '请对以下表格中用户选择的每个数据列进行全面分析，并为每一列生成最适合该数据特性的图表（如数值型列使用柱状图/折线图，分类型列使用饼图等）。最终需输出多个JSON格式的echarts配置项，数量应等于或多于选中的数据列数量。每个JSON需包含明确的title（包含列名），完整的图表配置，并确保视觉风格协调一致。此外，还需生成一个展示多列关系的综合图表。注意：请不要在JSON中使用JavaScript函数，使用固定颜色和值代替。同时提供每个维度的分析结论和所有维度的关联分析。表格数据：'
    },
    {
      id: 'template-5',
      name: '场景分布多维分析',
      prompt: '请分析以下表格数据中的多个维度，为用户选择的每个数据列都生成一个独立的可视化图表（分类数据使用饼图，数值数据使用柱状图或折线图），并额外生成一个展示这些维度关系的综合图表。输出多个完整的JSON格式echarts配置项，每个都需包含合适的标题（标明列名）、图例、提示框等。确保所有图表风格一致，便于比较。注意：请不要在JSON中使用JavaScript函数表达式，使用固定颜色数组和固定值代替函数。针对每个维度提供简要分析，并总结所有维度的关联特点。表格数据：'
    }
  ]);

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
      if (headerKeys.length > 0) {
        setSelectedDataColumns(headerKeys.length > 0 ? [headerKeys[0]] : []);
      }
      
      setExcelData(jsonData);
      message.success(`成功解析 ${jsonData.length} 行数据`);
      return false; // 阻止上传
    } catch (error) {
      console.error('解析Excel文件失败:', error);
      message.error('解析Excel文件失败');
      return false;
    }
  };

  // 处理图表模板选择
  const handleChartTemplateSelect = (templateId: string) => {
    setSelectedChartTemplate(templateId);
    const selectedTemplate = chartTemplates.find(t => t.id === templateId);
    if (selectedTemplate) {
      setChartPrompt(selectedTemplate.prompt);
    }
  };

  // 生成图表的处理函数
  const generateChart = async () => {
    if (excelData.length === 0 || selectedDataColumns.length === 0 || !chartModelId || !chartPrompt.trim()) {
      message.error('请上传数据、选择数据列、模型和填写提示词');
      return;
    }

    const selectedModelObj = models.find(m => m.id === chartModelId);
    if (!selectedModelObj) {
      message.error('所选模型无效');
      return;
    }

    // 清除上一次的结果
    setChartOption(null);
    setChartOptions([]);
    setChartError('');
    setChartDescription('');
    setIsGeneratingChart(true);

    try {
      // 准备数据，只保留选定的列
      const dataToAnalyze = excelData.map(item => {
        const filteredItem: any = {};
        // 只保留选定的列
        selectedDataColumns.forEach(column => {
          filteredItem[column] = item[column];
        });
        return filteredItem;
      });

      // 将数据转换为适合模型处理的格式
      const dataForModel = JSON.stringify(dataToAnalyze.slice(0, 100)); // 限制数据量
      
      // 构建完整的提示词
      const fullPrompt = `${chartPrompt}\n${dataForModel}`;
      
      // 调用模型生成图表配置
      const response = await callModel(selectedModelObj, fullPrompt, '');
      
      // 解析响应
      let responseContent = response.content;
      
      // 寻找JSON部分
      const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/g;
      let jsonMatches = [];
      let match;
      
      // 收集所有JSON代码块
      while ((match = jsonRegex.exec(responseContent)) !== null) {
        jsonMatches.push(match[1].trim());
      }
      
      // 从响应中提取描述文本
      let descriptionText = '';
      const parts = responseContent.split('```');
      descriptionText = parts
        .filter((_, index) => index % 2 === 0) // 取出所有不在代码块中的部分
        .join(' ')
        .trim();
      
      setChartDescription(descriptionText);
      
      // 如果找到JSON代码块
      if (jsonMatches.length > 0) {
        const configs = [];
        let hasValidConfig = false;
        
        // 处理每个JSON块
        for (const jsonContent of jsonMatches) {
          try {
            let chartConfig;
            
            // 检查是否包含函数表达式
            if (jsonContent.includes('function(') || jsonContent.includes('function (')) {
              try {
                // 将JSON字符串包装在一个返回对象的函数中
                const funcBody = `return ${jsonContent}`;
                // 创建并执行一个新函数，返回解析后的对象
                // eslint-disable-next-line no-new-func
                chartConfig = Function(funcBody)();
                
                console.log('成功解析包含函数的图表配置');
              } catch (funcError) {
                console.error('函数解析失败，尝试移除函数表达式:', funcError);
                
                // 如果函数解析失败，尝试移除函数定义，替换为固定值
                const simplifiedJson = jsonContent
                  .replace(/function\s*\([^)]*\)\s*{[^}]*}/g, '""') // 替换函数为空字符串
                  .replace(/,\s*}/g, '}') // 修复可能的尾随逗号
                  .replace(/,\s*]/g, ']'); // 修复可能的尾随逗号
                
                chartConfig = JSON.parse(simplifiedJson);
              }
            } else {
              // 标准JSON解析
              chartConfig = JSON.parse(jsonContent);
            }
            
            configs.push(chartConfig);
            hasValidConfig = true;
          } catch (parseError: any) {
            console.error('JSON解析错误:', parseError);
            // 继续处理下一个JSON块
          }
        }
        
        if (hasValidConfig) {
          // 如果有多个配置，保存到chartOptions
          if (configs.length > 1) {
            setChartOptions(configs);
            // 同时设置第一个作为主图表
            setChartOption(configs[0]);
          } else if (configs.length === 1) {
            // 只有一个配置，设置为主图表
            setChartOption(configs[0]);
          }
        } else {
          // 所有JSON解析都失败
          setChartError('所有图表配置解析失败，请调整提示词或检查格式');
        }
      } else {
        // 如果没有找到代码块，尝试直接解析整个响应
        try {
          let chartConfig;
          
          // 检查是否包含函数表达式
          if (responseContent.includes('function(') || responseContent.includes('function (')) {
            try {
              // 将JSON字符串包装在一个返回对象的函数中
              const funcBody = `return ${responseContent.trim()}`;
              // 创建并执行一个新函数，返回解析后的对象
              // eslint-disable-next-line no-new-func
              chartConfig = Function(funcBody)();
            } catch (funcError) {
              console.error('函数解析失败，尝试移除函数表达式:', funcError);
              
              // 如果函数解析失败，尝试移除函数定义，替换为固定值
              const simplifiedJson = responseContent.trim()
                .replace(/function\s*\([^)]*\)\s*{[^}]*}/g, '""')
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
              
              chartConfig = JSON.parse(simplifiedJson);
            }
          } else {
            // 标准JSON解析
            chartConfig = JSON.parse(responseContent.trim());
          }
          
          setChartOption(chartConfig);
        } catch (parseError: any) {
          console.error('响应解析错误:', parseError);
          setChartError('未找到有效的图表配置，请调整提示词重试');
          setChartDescription(responseContent); // 将整个响应作为描述显示
        }
      }
    } catch (error: any) {
      console.error('图表生成错误:', error);
      setChartError(`生成图表时出错: ${error.message || '未知错误'}`);
    } finally {
      setIsGeneratingChart(false);
    }
  };

  return (
    <Card 
      title="数据分析与图表"
      extra={
        <Tooltip title="系统支持解析含JavaScript函数的图表配置，但建议使用纯JSON格式以获得更好的兼容性">
          <InfoCircleOutlined style={{ color: '#1677ff' }} />
        </Tooltip>
      }
    >
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
                setSelectedDataColumns([]);
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
                    setSelectedDataColumns([]);
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
          <Title level={5}>第二步：配置图表分析</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label>选择数据列：</label>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择要分析的数据列"
                value={selectedDataColumns}
                onChange={setSelectedDataColumns}
                disabled={headers.length === 0}
                mode="multiple"
                allowClear
                maxTagCount={3}
                maxTagTextLength={10}
              >
                {headers.map(header => (
                  <Option key={header} value={header}>
                    {header}
                  </Option>
                ))}
              </Select>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                可多选，只有选中的数据列会被传递给模型
              </Text>
            </div>
            
            <div>
              <label>选择模型：</label>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择模型"
                value={chartModelId}
                onChange={setChartModelId}
              >
                {models.map(model => (
                  <Option key={model.id} value={model.id}>
                    {model.name}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div>
              <label>图表分析模板：</label>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择图表分析模板"
                value={selectedChartTemplate}
                onChange={handleChartTemplateSelect}
                allowClear
              >
                {chartTemplates.map(template => (
                  <Option key={template.id} value={template.id}>
                    {template.name}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div>
              <label>提示词：</label>
              <TextArea
                placeholder="请输入提示词，描述你想要的图表类型和分析要求"
                value={chartPrompt}
                onChange={e => setChartPrompt(e.target.value)}
                rows={4}
              />
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                提示：要求模型输出JSON格式的echarts配置项，并包含数据分析结论
              </Text>
            </div>
            
            <div>
              <Button
                type="primary"
                icon={<BarChartOutlined />}
                onClick={generateChart}
                loading={isGeneratingChart}
                disabled={selectedDataColumns.length === 0 || !chartModelId || !chartPrompt.trim() || excelData.length === 0}
              >
                生成图表
              </Button>
            </div>
          </div>
        </div>
        
        <Divider />
        
        <div>
          <Title level={5}>第三步：查看分析结果</Title>
          {isGeneratingChart ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin tip="正在分析数据并生成图表..." />
            </div>
          ) : chartError ? (
            <div style={{ padding: '16px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '4px' }}>
              <Text type="danger">{chartError}</Text>
              {chartDescription && (
                <Paragraph style={{ marginTop: '16px', whiteSpace: 'pre-wrap' }}>
                  {chartDescription}
                </Paragraph>
              )}
            </div>
          ) : chartOption ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Card 
                title={(() => {
                  // 处理主图表的标题去重
                  let titleText = chartOption.title?.text || "数据可视化";
                  
                  // 从标题中提取关键部分，避免重复
                  let cleanTitle = titleText;
                  if (titleText.includes('-')) {
                    const parts = titleText.split('-');
                    cleanTitle = parts[0].trim();
                  } else if (titleText.includes('：')) {
                    const parts = titleText.split('：');
                    cleanTitle = parts[0].trim();
                  } else if (titleText.includes(':')) {
                    const parts = titleText.split(':');
                    cleanTitle = parts[0].trim();
                  }
                  
                  return `主图表: ${cleanTitle}`;
                })()} 
                bordered={false}
              >
                <ReactECharts
                  option={(() => {
                    // 深拷贝主图表选项对象，以便安全修改
                    const optionCopy = JSON.parse(JSON.stringify(chartOption));
                    
                    // 处理标题去重
                    let titleText = optionCopy.title?.text || "数据可视化";
                    
                    // 从标题中提取关键部分，避免重复
                    let cleanTitle = titleText;
                    if (titleText.includes('-')) {
                      const parts = titleText.split('-');
                      cleanTitle = parts[0].trim();
                    } else if (titleText.includes('：')) {
                      const parts = titleText.split('：');
                      cleanTitle = parts[0].trim();
                    } else if (titleText.includes(':')) {
                      const parts = titleText.split(':');
                      cleanTitle = parts[0].trim();
                    }
                    
                    // 确保title对象存在
                    if (!optionCopy.title) {
                      optionCopy.title = {};
                    }
                    
                    // 设置新的标题文本
                    // optionCopy.title.text = `主图表: ${cleanTitle}`;
                    
                    return optionCopy;
                  })()}
                  style={{ height: '400px', width: '100%' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </Card>
              
              {/* 如果有多个图表，显示额外的图表 */}
              {chartOptions.length > 1 && (
                <Card 
                  title="多维度数据分析图表" 
                  bordered={false}
                  extra={
                    <Tooltip title="点击标签页可查看不同维度的详细图表">
                      <InfoCircleOutlined style={{ color: '#1677ff' }} />
                    </Tooltip>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
                    以下是详细的多维度数据分析图表。每个标签页显示一个完整的图表，您可以点击彩色标签切换不同的数据维度视图，深入分析数据特征。
                  </Paragraph>
                  <Tabs defaultActiveKey="0" type="card">
                    {chartOptions.map((option, index) => {
                      // 使用与其他部分相同的颜色方案
                      const colorScheme = COLOR_SCHEMES[index % COLOR_SCHEMES.length];
                      
                      // 深拷贝选项对象，以便安全修改
                      const optionCopy = JSON.parse(JSON.stringify(option));
                      
                      // 设置图表的颜色
                      if (optionCopy.series && Array.isArray(optionCopy.series)) {
                        optionCopy.color = colorScheme;
                      }
                      
                      const mainColor = colorScheme[0];
                      
                      // 处理标题去重
                      let titleText = option.title?.text || `图表 ${index + 1}`;
                      
                      // 从标题中提取关键部分，避免重复
                      let cleanTitle = titleText;
                      if (titleText.includes('-')) {
                        const parts = titleText.split('-');
                        cleanTitle = parts[0].trim();
                      } else if (titleText.includes('：')) {
                        const parts = titleText.split('：');
                        cleanTitle = parts[0].trim();
                      } else if (titleText.includes(':')) {
                        const parts = titleText.split(':');
                        cleanTitle = parts[0].trim();
                      }
                      
                      const tabTitle = (
                        <span style={{ color: mainColor }}>
                          {index + 1}. {cleanTitle}
                        </span>
                      );
                      
                      return (
                        <Tabs.TabPane 
                          tab={tabTitle}
                          key={index.toString()}
                        >
                          <ReactECharts
                            option={optionCopy}
                            style={{ height: '400px', width: '100%' }}
                            notMerge={true}
                            lazyUpdate={true}
                          />
                        </Tabs.TabPane>
                      );
                    })}
                  </Tabs>
                </Card>
              )}
              
              {/* 添加多图表网格视图，方便用户同时查看多个图表 */}
              {chartOptions.length > 1 && (
                <Card 
                  title="图表概览" 
                  bordered={false}
                  extra={
                    <Tooltip title="每个图表使用独立的颜色方案，便于区分不同维度数据">
                      <InfoCircleOutlined style={{ color: '#1677ff' }} />
                    </Tooltip>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
                    下面展示了所有生成的图表，每个图表使用独特的颜色方案以便于区分不同数据维度。您可以通过这个概览快速比较不同图表之间的关系和差异。
                  </Paragraph>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                    {chartOptions.map((option, index) => {
                      // 为每个图表定义不同的颜色主题
                      const colorScheme = COLOR_SCHEMES[index % COLOR_SCHEMES.length];
                      
                      // 深拷贝选项对象，以便安全修改
                      const optionCopy = JSON.parse(JSON.stringify(option));
                      
                      // 设置图表的颜色
                      if (optionCopy.series && Array.isArray(optionCopy.series)) {
                        // 添加颜色数组到选项中
                        optionCopy.color = colorScheme;
                      }
                      
                      // 边框颜色变化，增加视觉区分
                      const borderColor = colorScheme[0];
                      
                      // 处理标题去重
                      let titleText = option.title?.text || `图表 ${index + 1}`;
                      
                      // 从标题中提取关键部分，避免重复
                      let cleanTitle = titleText;
                      if (titleText.includes('-')) {
                        const parts = titleText.split('-');
                        cleanTitle = parts[0].trim();
                      } else if (titleText.includes('：')) {
                        const parts = titleText.split('：');
                        cleanTitle = parts[0].trim();
                      } else if (titleText.includes(':')) {
                        const parts = titleText.split(':');
                        cleanTitle = parts[0].trim();
                      }
                      
                      // 确保title对象存在
                      if (!optionCopy.title) {
                        optionCopy.title = {};
                      }
                      
                      // 设置新的标题文本
                      optionCopy.title.text = `${index + 1}. ${cleanTitle}`;
                      
                      return (
                        <div key={index} style={{ 
                          border: `1px solid ${borderColor}`,
                          borderRadius: '4px', 
                          padding: '8px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                        }}>
                          {/* <Typography.Title level={5} style={{ 
                            marginBottom: '8px',
                            color: borderColor
                          }}>
                            {optionCopy.title.text}
                          </Typography.Title> */}
                          <ReactECharts
                            option={optionCopy}
                            style={{ height: '300px', width: '100%' }}
                            notMerge={true}
                            lazyUpdate={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              
              {chartDescription && (
                <Card title="分析结论" bordered={false}>
                  <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                    {chartDescription}
                  </Paragraph>
                </Card>
              )}
              
              <Card title="图表配置" bordered={false} size="small">
                <Collapse>
                  <Panel header="查看完整配置" key="1">
                    <Tabs defaultActiveKey="1">
                      <Tabs.TabPane 
                        tab={
                          <span style={{ color: '#5470c6' }}>
                            主图表
                          </span>
                        } 
                        key="1"
                      >
                        <pre style={{ 
                          maxHeight: '300px', 
                          overflow: 'auto', 
                          backgroundColor: '#f5f5f5', 
                          padding: '8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          borderLeft: '3px solid #5470c6'
                        }}>
                          {JSON.stringify(chartOption, null, 2)}
                        </pre>
                      </Tabs.TabPane>
                      
                      {chartOptions.length > 1 && chartOptions.map((option, index) => {
                        // 使用与其他部分相同的颜色方案
                        const colorScheme = COLOR_SCHEMES[index % COLOR_SCHEMES.length];
                        
                        const mainColor = colorScheme[0];
                        
                        // 处理标题去重
                        let titleText = option.title?.text || `图表 ${index + 1}`;
                        
                        // 从标题中提取关键部分，避免重复
                        let cleanTitle = titleText;
                        if (titleText.includes('-')) {
                          const parts = titleText.split('-');
                          cleanTitle = parts[0].trim();
                        } else if (titleText.includes('：')) {
                          const parts = titleText.split('：');
                          cleanTitle = parts[0].trim();
                        } else if (titleText.includes(':')) {
                          const parts = titleText.split(':');
                          cleanTitle = parts[0].trim();
                        }
                        
                        const tabTitle = (
                          <span style={{ color: mainColor }}>
                            {index + 1}. {cleanTitle}
                          </span>
                        );
                        
                        return (
                          <Tabs.TabPane tab={tabTitle} key={`${index + 2}`}>
                            <pre style={{ 
                              maxHeight: '300px', 
                              overflow: 'auto', 
                              backgroundColor: '#f5f5f5', 
                              padding: '8px', 
                              borderRadius: '4px',
                              fontSize: '12px',
                              borderLeft: `3px solid ${mainColor}`
                            }}>
                              {JSON.stringify(option, null, 2)}
                            </pre>
                          </Tabs.TabPane>
                        );
                      })}
                    </Tabs>
                  </Panel>
                </Collapse>
              </Card>
            </div>
          ) : (
            <Empty description="选择数据列和模型，然后生成图表" />
          )}
        </div>
      </div>
    </Card>
  );
};

export default ChartAnalyzer; 