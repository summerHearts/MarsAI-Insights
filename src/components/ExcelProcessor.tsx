import React, { useState } from 'react';
import { 
  Upload, Button, Select, Card, Table, Checkbox, 
  Space, Typography, message, Spin, Divider, Alert, Radio
} from 'antd';
import { UploadOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { UploadChangeParam } from 'antd/es/upload';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;

interface ColumnData {
  key: string;
  uniqueValues: string[];
  selectedValues: string[];
}

const ExcelProcessor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [columnData, setColumnData] = useState<ColumnData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<any[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [processMode, setProcessMode] = useState<'separate' | 'combined'>('separate');

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
    console.log('readFileAsArrayBuffer开始, 文件:', file.name, '大小:', file.size, '类型:', file.type);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        console.log('FileReader.onload触发');
        if (e.target && e.target.result) {
          console.log('读取成功, 数据类型:', typeof e.target.result);
          resolve(e.target.result as ArrayBuffer);
        } else {
          console.error('FileReader.onload但结果为空');
          reject(new Error('读取文件失败，结果为空'));
        }
      };
      
      reader.onerror = (e) => {
        console.error('FileReader.onerror触发:', e);
        console.error('FileReader错误:', reader.error);
        reject(new Error(`读取文件出错: ${reader.error?.message || '未知错误'}`));
      };
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentLoaded = Math.round((e.loaded / e.total) * 100);
          console.log(`文件读取进度: ${percentLoaded}%`);
        }
      };
      
      try {
        console.log('开始调用readAsArrayBuffer...');
        reader.readAsArrayBuffer(file);
        console.log('调用readAsArrayBuffer成功');
      } catch (error) {
        console.error('调用readAsArrayBuffer失败:', error);
        reject(error);
      }
    });
  };

  // 处理文件上传前的验证
  const handleBeforeUpload = (file: RcFile) => {
    console.log('handleBeforeUpload调用:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });
    
    const isExcelType = isExcelFile(file);
    console.log('文件类型检查结果:', isExcelType ? '是Excel文件' : '不是Excel文件');
    
    if (!isExcelType) {
      message.error('只能上传 Excel 文件(.xlsx, .xls)');
      return Upload.LIST_IGNORE;
    }
    
    // 直接在这里处理文件，避免 onChange 时 originFileObj 丢失的问题
    handleExcelFile(file);
    
    console.log('文件类型检查通过，阻止自动上传');
    return false; // 阻止自动上传
  };

  // 直接处理Excel文件
  const handleExcelFile = async (excelFile: RcFile) => {
    console.log('开始处理Excel文件:', excelFile.name);
    
    // 清除之前的数据
    setExcelData([]);
    setColumns([]);
    setSelectedColumn('');
    setColumnData(null);
    setPreviewData([]);
    setTableColumns([]);
    
    setLoading(true);
    setFile(excelFile);
    
    try {
      console.log('准备读取文件内容...');
      // 直接从RcFile读取
      const data = await readFileAsArrayBuffer(excelFile);
      console.log('文件读取完成, 数据大小:', data.byteLength, '字节');
      
      try {
        console.log('开始解析Excel数据...');
        // 读取Excel工作簿
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        console.log('Excel工作簿解析成功, 工作表:', workbook.SheetNames);
        
        if (workbook.SheetNames.length === 0) {
          console.error('Excel文件不包含任何工作表');
          message.error('Excel文件不包含任何工作表');
          setLoading(false);
          return;
        }
        
        // 获取第一个工作表
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        console.log('选择工作表:', workbook.SheetNames[0]);
        
        // 将工作表转换为JSON
        console.log('开始将工作表转换为JSON...');
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        console.log('工作表转换完成, 数据行数:', jsonData.length);
        
        if (jsonData.length === 0) {
          console.warn('Excel文件不包含任何数据行');
          message.warning('上传的Excel文件不包含任何数据');
          setLoading(false);
          return;
        }
        
        // 检查第一行数据
        console.log('第一行数据样例:', JSON.stringify(jsonData[0]).substring(0, 200) + '...');
        
        setExcelData(jsonData as any[]);
        
        // 获取所有列名
        const columnNames = Object.keys(jsonData[0] as object);
        console.log('检测到列名:', columnNames);
        setColumns(columnNames);
        
        message.success('文件上传成功！');
      } catch (error) {
        console.error('Excel解析错误:', error);
        // 更详细地记录错误信息
        if (error instanceof Error) {
          console.error('错误名称:', error.name);
          console.error('错误信息:', error.message);
          console.error('错误堆栈:', error.stack);
        }
        message.error('Excel文件解析失败，请确保文件格式正确');
      }
    } catch (error) {
      console.error('文件读取错误:', error);
      // 更详细地记录错误信息
      if (error instanceof Error) {
        console.error('错误名称:', error.name);
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
      }
      message.error('读取文件时出错，请确保文件可访问');
    } finally {
      console.log('文件处理完成');
      setLoading(false);
    }
  };

  // 处理文件上传（仅用于显示上传状态，实际处理在handleBeforeUpload中）
  const handleFileUpload = (info: UploadChangeParam<UploadFile<any>>) => {
    console.log('onChange事件触发:', info.file.status);
    // 这里不做实际处理，因为originFileObj在这里可能已经丢失
  };

  // 处理列选择
  const handleColumnSelect = (value: string) => {
    setSelectedColumn(value);
    
    // 获取选定列的唯一值
    if (excelData.length > 0) {
      const uniqueValues = Array.from(
        new Set(excelData.map(item => {
          const cellValue = item[value];
          return cellValue !== undefined && cellValue !== null 
            ? String(cellValue).trim() 
            : '';
        }))
      )
        .filter(val => val !== '')
        .sort();
      
      if (uniqueValues.length === 0) {
        message.warning(`所选列 "${value}" 不包含有效数据`);
        return;
      }
      
      setColumnData({
        key: value,
        uniqueValues,
        selectedValues: [...uniqueValues] // 默认全选
      });
      
      setSelectAll(true);
    }
  };

  // 处理单个值的选择变更
  const handleValueSelect = (value: string, checked: boolean) => {
    if (columnData) {
      const newSelectedValues = checked
        ? [...columnData.selectedValues, value]
        : columnData.selectedValues.filter(v => v !== value);
      
      setColumnData({
        ...columnData,
        selectedValues: newSelectedValues
      });
      
      setSelectAll(newSelectedValues.length === columnData.uniqueValues.length);
    }
  };

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    
    if (columnData) {
      setColumnData({
        ...columnData,
        selectedValues: checked ? [...columnData.uniqueValues] : []
      });
    }
  };

  // 处理数据筛选并生成新表
  const handleProcessData = () => {
    if (!columnData || !file) {
      message.warning('请先上传文件并选择列');
      return;
    }

    if (columnData.selectedValues.length === 0) {
      message.warning('请至少选择一个值');
      return;
    }

    setLoading(true);

    try {
      // 根据所选的值筛选数据
      const filteredData = excelData.filter(row => {
        const cellValue = row[columnData.key];
        if (cellValue === undefined || cellValue === null) {
          return false;
        }
        const stringValue = String(cellValue).trim();
        return columnData.selectedValues.includes(stringValue);
      });
      
      if (filteredData.length === 0) {
        message.warning('筛选结果为空，请重新选择');
        setLoading(false);
        return;
      }

      // 预览数据（最多显示10行）
      setPreviewData(filteredData.slice(0, 10));
      
      // 设置表格列
      if (filteredData.length > 0) {
        const tableColumnsConfig = Object.keys(filteredData[0]).map(key => ({
          title: key,
          dataIndex: key,
          key: key,
          ellipsis: true,
          render: (text: any) => {
            if (text === null || text === undefined) return '-';
            return String(text);
          }
        }));
        setTableColumns(tableColumnsConfig);
      }

      // 生成新的Excel工作簿
      const workbook = XLSX.utils.book_new();

      if (processMode === 'combined') {
        // 合并模式：将所有选中值的数据放在同一个工作表中
        const worksheet = XLSX.utils.json_to_sheet(filteredData);
        const sheetName = `${columnData.selectedValues.join('_').substring(0, 20)}等${columnData.selectedValues.length}项`;
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      } else {
        // 分离模式：为每个选中的值创建一个工作表
        columnData.selectedValues.forEach(value => {
          // 筛选出当前值的所有数据
          const sheetData = excelData.filter(row => {
            const cellValue = row[columnData.key];
            if (cellValue === undefined || cellValue === null) {
              return false;
            }
            return String(cellValue).trim() === value;
          });
          
          if (sheetData.length > 0) {
            try {
              // 创建工作表
              const worksheet = XLSX.utils.json_to_sheet(sheetData);
              
              // 添加到工作簿
              // 处理特殊字符，避免无效的工作表名
              const safeSheetName = value.substring(0, 30)
                .replace(/[\/[\]?*:]/g, '_') // 替换不允许的字符
                .replace(/^[\s']+|[\s']+$/g, '') // 去除首尾空格和单引号
                .replace(/^(\d)/, '_$1'); // 如果以数字开头，添加下划线
                
              if (safeSheetName === '') {
                // 如果净化后的名称为空，使用默认名称
                XLSX.utils.book_append_sheet(workbook, worksheet, `工作表_${columnData.selectedValues.indexOf(value) + 1}`);
              } else {
                XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
              }
            } catch (sheetError) {
              console.error(`创建工作表 "${value}" 时出错:`, sheetError);
            }
          }
        });
      }

      // 另外创建一个包含所有筛选数据的总表
      try {
        const allFilteredWorksheet = XLSX.utils.json_to_sheet(filteredData);
        XLSX.utils.book_append_sheet(workbook, allFilteredWorksheet, '全部数据');
        
        // 导出Excel文件
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const fileName = `处理结果_${columnData.key}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        
        saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), fileName);
        
        message.success('数据处理完成，文件已下载');
      } catch (exportError) {
        console.error('导出Excel文件时出错:', exportError);
        message.error('导出Excel文件失败');
      }
    } catch (error) {
      message.error('数据处理失败');
      console.error('处理错误:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <Spin spinning={loading}>
        <Title level={2}>Excel 表格处理工具</Title>
        <Divider />
        
        <Card title="第一步：上传 Excel 文件" style={{ marginBottom: 16 }}>
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            maxCount={1}
            beforeUpload={handleBeforeUpload}
            onChange={handleFileUpload}
            disabled={loading}
          >
            <Button icon={<UploadOutlined />} type="primary" loading={loading}>
              {loading ? '处理中...' : '选择 Excel 文件'}
            </Button>
          </Upload>
          {file && (
            <Text style={{ marginLeft: 8 }}>
              已选择文件: {file.name}
            </Text>
          )}
        </Card>
        
        {columns.length > 0 && (
          <Card title="第二步：选择要处理的列" style={{ marginBottom: 16 }}>
            <Select
              placeholder="请选择一列进行处理"
              style={{ width: 300 }}
              onChange={handleColumnSelect}
              value={selectedColumn || undefined}
            >
              {columns.map(col => (
                <Option key={col} value={col}>{col}</Option>
              ))}
            </Select>
          </Card>
        )}
        
        {columnData && (
          <Card title="第三步：选择要包含的值" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <Checkbox 
                checked={selectAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
              >
                全选 ({columnData.uniqueValues.length} 项)
              </Checkbox>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
              <Space direction="vertical">
                {columnData.uniqueValues.map(value => (
                  <Checkbox 
                    key={value}
                    checked={columnData.selectedValues.includes(value)}
                    onChange={(e) => handleValueSelect(value, e.target.checked)}
                  >
                    {value}
                  </Checkbox>
                ))}
              </Space>
            </div>
            
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                已选择 {columnData.selectedValues.length} 项，共 {columnData.uniqueValues.length} 项
              </Text>
            </div>
          </Card>
        )}
        
        {columnData && columnData.selectedValues.length > 0 && (
          <Card title="第四步：处理数据并下载" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Radio.Group value={processMode} onChange={e => setProcessMode(e.target.value)}>
                <Space direction="vertical">
                  <Radio value="separate">为每个选中项创建单独的工作表</Radio>
                  <Radio value="combined">将所有选中项合并到同一个工作表</Radio>
                </Space>
              </Radio.Group>

              <Button 
                type="primary" 
                icon={<FileExcelOutlined />} 
                onClick={handleProcessData}
              >
                处理数据并下载 Excel
              </Button>
              
              <Alert
                message="说明"
                description={processMode === 'separate' 
                  ? `将为每个选中的「${selectedColumn}」值创建单独的工作表，并在「全部数据」工作表中包含所有筛选后的数据。`
                  : `将所有选中的「${selectedColumn}」值的数据合并到同一个工作表中，并在「全部数据」工作表中包含所有筛选后的数据。`
                }
                type="info"
                showIcon
              />
            </Space>
          </Card>
        )}
        
        {previewData.length > 0 && (
          <Card title="数据预览（最多10条）" style={{ marginBottom: 16 }}>
            <Table
              columns={tableColumns}
              dataSource={previewData}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowKey={(record, index) => `${index}`}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default ExcelProcessor; 