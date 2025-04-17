export interface Model {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  requestPath?: string;
  requestTemplate?: string;
  forceModelName?: string;
  supportsStreaming?: boolean;
}

export interface ModelResponse {
  modelId: string;
  modelName: string;
  responseTime: number;
  content: string;
  rawResponse?: any;
  error?: string;
  processedInput?: string;
}

export interface ComparisonResult {
  prompt: string;
  input: string;
  responses: ModelResponse[];
  timestamp: number;
}

export interface SavedComparison extends ComparisonResult {
  id: string;
  title: string;
}

// 批处理任务状态
export interface BatchProcessingStatus {
  totalItems: number;
  processedItems: number;
  success: number;
  failed: number;
  isProcessing: boolean;
}

// 批处理任务项
export interface BatchProcessItem {
  id: string;
  input: string;
  output?: string;
  error?: string;
  processingTime?: number;
}

// 批处理结果
export interface BatchProcessResult {
  id: string;
  title: string;
  prompt: string;
  modelId: string;
  modelName: string;
  items: BatchProcessItem[];
  timestamp: number;
  processingTime: number;
}

// 保存的输入内容
export interface SavedInput {
  id: string;
  title: string;
  prompt: string;
  input: string;
  timestamp: number;
}

// Excel文件数据项
export interface ExcelItem {
  [key: string]: any;
  _rowId: number; // 用于标识行
}

// 简化的Excel文件数据项，用于存储时压缩体积
export interface CompressedExcelItem {
  _rowId: number;
  [key: string]: any; // 只保留必要的列
}

// Excel批处理任务
export interface BatchJob {
  id: string;
  title: string;
  timestamp: number;
  modelId: string;
  prompt: string;
  inputColumnKey: string;
  status: BatchProcessingStatus;
  originalData: ExcelItem[];
  processedData: ExcelItem[];
  outputColumnKey: string;
  headers: string[];
  compressed?: boolean; // 标记该任务是否被压缩存储
}

// 压缩存储的Excel批处理任务
export interface CompressedBatchJob {
  id: string;
  title: string;
  timestamp: number;
  modelId: string;
  prompt: string;
  inputColumnKey: string;
  status: BatchProcessingStatus;
  originalData: CompressedExcelItem[]; // 压缩后的原始数据
  processedData: CompressedExcelItem[]; // 压缩后的处理结果
  outputColumnKey: string;
  headers: string[];
  compressed: boolean; // 标记该任务已被压缩存储
} 