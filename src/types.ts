import { FeishuConfig } from './services/feishuService';

export interface Model {
  id: string;
  name: string;
  baseUrl: string;
  requestPath?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  requestTemplate?: string;
  forceModelName?: string;
  supportsStreaming?: boolean;
  disabled?: boolean;
}

export interface ModelResponse {
  modelId: string;
  modelName: string;
  content: string;
  responseTime: number;
  prompt?: string;
  input?: string;
  processedInput?: string;
  rawResponse?: any;
  error?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export interface SavedComparison {
  id: string;
  title: string;
  prompt: string;
  input: string;
  responses: ModelResponse[];
  timestamp: number;
}

export interface SavedInput {
  id: string;
  title: string;
  prompt: string;
  input: string;
  timestamp: number;
}

export interface TextProcessors {
  removeTimestamps: boolean;
  removeHtmlTags: boolean;
  normalizeWhitespace: boolean;
  removeDataMarkers: boolean;
  enhanceRoles: boolean;
  removeSpecialChars: boolean;
}

export interface PreprocessOptions {
  normalizeWhitespace: boolean;
  removeDataMarkers: boolean;
  removeSpecialChars: boolean;
}

export interface ExcelItem {
  _rowId: number; // 添加行ID以便追踪
  [key: string]: any;
}

export interface BatchProcessingConfig {
  templateId?: string;
  modelIds: string[];
  inputColumnKey?: string;
  outputColumnKey?: string;
  enablePreprocess: boolean;
  textProcessors: TextProcessors;
  customPatterns: string;
  speakerMap: string;
  resultAggregateType: 'single' | 'separate';
  maxConcurrent: number;
  notifyOnComplete: boolean;
  feishuConfig?: FeishuConfig;
}

/**
 * 批处理进度状态
 */
export interface BatchProcessingStatus {
  totalItems: number;
  processedItems: number;
  success: number;
  failed: number;
  isProcessing: boolean;
}

/**
 * 批处理任务
 */
export interface BatchJob {
  id: string;
  title: string;
  timestamp: number;
  modelId: string;
  templateId?: string;
  prompt: string;
  inputColumnKey: string;
  outputColumnKey: string;
  status: BatchProcessingStatus;
  originalData: ExcelItem[];
  processedData: ExcelItem[];
  headers: string[];
  notifyOnComplete: boolean;
  feishuConfig: FeishuConfig;
} 