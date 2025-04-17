import { read, utils, writeFile, write } from 'xlsx';
import { saveAs } from 'file-saver';
import { ExcelItem } from '../types';

/**
 * 将Excel文件转换为JSON数据
 */
export const excelToJson = async (file: File): Promise<ExcelItem[]> => {
  try {
    const data = await file.arrayBuffer();
    const workbook = read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json(worksheet);
    
    // 添加行ID
    return jsonData.map((row: any, index) => ({
      ...row,
      _rowId: index
    })) as ExcelItem[];
  } catch (error) {
    console.error('解析Excel文件失败:', error);
    throw new Error('解析Excel文件失败');
  }
};

/**
 * 获取Excel数据中的表头
 */
export const getHeaders = (data: ExcelItem[]): string[] => {
  if (data.length === 0) {
    return [];
  }
  
  return Object.keys(data[0]).filter(key => key !== '_rowId');
};

/**
 * 将JSON数据导出为Excel文件
 * @param data 要导出的数据
 * @param filename 文件名
 * @param originalHeaders 原始数据的表头
 * @param outputColumn 模型输出的主列名
 */
export const jsonToExcel = (
  data: ExcelItem[], 
  filename: string, 
  originalHeaders: string[] = [],
  outputColumn: string = '模型输出'
): void => {
  try {
    // 过滤掉null或undefined项
    const validData = data.filter(item => item != null);
    
    if (validData.length === 0) {
      throw new Error('没有有效数据可导出');
    }
    
    // 收集所有列名，包括原始列和直接从JSON解析出的键值列
    const allColumns = new Set<string>(originalHeaders);
    
    // 添加模型输出列
    allColumns.add(outputColumn);
    
    // 找出所有从JSON直接解析的列（形如 outputColumn_key 的列）
    validData.forEach(item => {
      Object.keys(item).forEach(key => {
        // 只保留原始列和直接从JSON解析的一级键值列
        // 排除角色/内容等特殊处理的列和内部字段
        if (
          !key.startsWith('_') && // 排除内部字段
          !originalHeaders.includes(key) && // 不是原始列
          key !== outputColumn && // 不是主输出列
          key.startsWith(`${outputColumn}_`) && // 是从输出解析的列
          !key.includes(`${outputColumn}_角色`) && // 排除角色列
          !key.includes(`${outputColumn}_内容`) && // 排除内容列
          !/_\d+$/.test(key) // 排除带有数字索引的数组元素列
        ) {
          allColumns.add(key);
        }
      });
    });
    
    // 将列名转换为数组并排序
    const columnsToExport = Array.from(allColumns);
    
    // 移除内部使用的标记字段，但保留所有数据字段（包括结构化输出的列）
    const cleanData = validData.map(item => {
      const cleanItem: Record<string, any> = {};
      
      // 只保留指定的列
      columnsToExport.forEach(columnKey => {
        if (columnKey in item) {
          cleanItem[columnKey] = item[columnKey] ?? '';
        } else {
          cleanItem[columnKey] = '';
        }
      });
      
      return cleanItem;
    });
    
    // 创建工作表
    const worksheet = utils.json_to_sheet(cleanData);
    
    // 创建工作簿
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Data');
    
    // 浏览器环境下正确的导出方式：先生成二进制数据，再用file-saver保存
    const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${filename}.xlsx`);
  } catch (error) {
    console.error('导出Excel文件失败:', error);
    throw new Error('导出Excel文件失败');
  }
}; 