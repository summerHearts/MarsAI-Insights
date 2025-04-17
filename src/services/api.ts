import axios from 'axios';
import { Model, ModelResponse } from '../types';

// 清理和转义JSON字符串
const sanitizeAndEscapeString = (str: string): string => {
  // 移除非法控制字符，使用更安全的正则表达式
  let cleaned = str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  
  // 转义特殊字符
  cleaned = cleaned
    .replace(/\\/g, '\\\\')    // 反斜杠
    .replace(/"/g, '\\"')      // 双引号
    .replace(/\n/g, '\\n')     // 换行
    .replace(/\r/g, '\\r')     // 回车
    .replace(/\t/g, '\\t')     // 制表符
    .replace(/\f/g, '\\f')     // 换页
    .replace(/\b/g, '\\b');    // 退格
    
  return cleaned;
};

// 安全地替换模板变量
const safeTemplateReplace = (template: string, variables: Record<string, string>): string => {
  let result = template;
  
  // 遍历所有变量进行替换
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    // 确保值被正确转义
    const escapedValue = sanitizeAndEscapeString(value);
    result = result.replace(regex, escapedValue);
  });
  
  return result;
};

// 安全地解析JSON字符串
const safeJsonParse = (str: string) => {
  try {
    // 尝试直接解析
    return JSON.parse(str);
  } catch (error: any) {
    console.error('JSON解析错误:', error);
    console.log('原始字符串:', str);
    
    // 如果解析失败，尝试修复常见问题
    try {
      // 移除可能的BOM标记
      const withoutBOM = str.replace(/^\uFEFF/, '');
      // 确保所有引号都是正确的
      const fixedQuotes = withoutBOM.replace(/[""]/g, '"');
      // 尝试再次解析
      return JSON.parse(fixedQuotes);
    } catch (retryError: any) {
      throw new Error(`JSON解析失败: ${error.message}\n修复尝试也失败: ${retryError.message}`);
    }
  }
};

// 添加文本预处理函数
const preprocessText = (text: string): string => {
  // 1. 移除多余的空白字符
  let processed = text.trim().replace(/\s+/g, ' ');
  
  // 2. 移除重复的标点符号
  processed = processed.replace(/([。，！？；：、])\1+/g, '$1');
  
  // 3. 统一全角/半角字符
  processed = processed.replace(/[\uff01-\uff5e]/g, (ch) => {
    return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
  });
  
  // 4. 修正常见的错误格式
  processed = processed
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
    .replace(/\([^)]*\)/g, match => match.replace(/\s+/g, '')) // 处理括号内的空格
    .replace(/([。，！？；：、])\s+/g, '$1') // 移除标点符号后的空格
    .replace(/\s+([。，！？；：、])/g, '$1'); // 移除标点符号前的空格
  
  return processed;
};

// 修改处理流式响应的辅助函数以支持QWQ模型和OpenRouter
const processStreamChunk = (chunk: string): { content?: string, reasoning_content?: string } | null => {
  try {
    // 移除"data: "前缀
    let jsonStr = chunk.replace(/^data: /, '').trim();
    
    // 忽略[DONE]消息
    if (jsonStr === '[DONE]') {
      return null;
    }
    
    // 处理OpenRouter特殊格式的消息
    if (jsonStr.startsWith(': OPENROUT') || !jsonStr.startsWith('{')) {
      console.log('跳过非JSON格式的流式响应:', jsonStr);
      return null;
    }
    
    // 处理错误格式的JSON（如尾部缺少大括号）
    try {
      JSON.parse(jsonStr);
    } catch (parseError) {
      // 尝试修复可能的JSON格式问题
      if (!jsonStr.endsWith('}') && jsonStr.includes('{')) {
        jsonStr = jsonStr + '}';
      }
      // 如果还有其他格式问题，在这里添加更多修复逻辑
    }
    
    // 解析JSON
    const data = JSON.parse(jsonStr);
    
    // 提取内容
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      
      // 不同模型可能有不同的内容字段路径
      const result: { content?: string, reasoning_content?: string } = {};
      
      if (choice.delta?.content) {
        result.content = choice.delta.content;
      }
      
      if (choice.delta?.reasoning_content) {
        result.reasoning_content = choice.delta.reasoning_content;
      }
      
      if (choice.delta?.text) {
        result.content = choice.delta.text;
      }
      
      // 火山引擎豆包模型的响应格式
      if (choice.delta?.message?.content) {
        result.content = choice.delta.message.content;
      }
      
      // OpenRouter可能使用的其他格式
      if (choice.content) {
        result.content = choice.content;
      }
      
      if (Object.keys(result).length > 0) {
        return result;
      }
    }
    
    return null;
  } catch (error) {
    console.error('处理流式响应块时出错:', error);
    console.log('出错的响应块:', chunk); // 记录出错的具体响应块内容，便于调试
    return null;
  }
};

// 确保请求头值只包含ASCII字符
const sanitizeHeaderValue = (value: string): string => {
  // 如果值中包含非ASCII字符，则使用encodeURIComponent进行编码或移除它们
  if (/[^\x00-\x7F]/.test(value)) {
    console.warn(`请求头包含非ASCII字符，进行编码: ${value}`);
    // 简单的解决方案：使用Base64编码
    try {
      return 'Base64:' + btoa(unescape(encodeURIComponent(value)));
    } catch (e) {
      // 如果编码出错，返回一个安全的替代值
      return 'Mars API Client';
    }
  }
  return value;
};

export const callModel = async (
  model: Model,
  prompt: string,
  input: string,
  options: {
    temperature?: number;    // 控制随机性，0-1之间，默认0.1
    topP?: number;          // 控制采样概率，0-1之间，默认0.9
    enablePreprocess?: boolean; // 是否启用文本预处理
  } = {}
): Promise<ModelResponse> => {
  const startTime = Date.now();
  
  try {
    // 文本预处理
    let processedInput = input;
    if (options.enablePreprocess) {
      processedInput = preprocessText(input);
      console.log('启用文本预处理，处理后的文本:', processedInput);
    }

    // 构建请求体，使用安全的模板替换
    let requestBody = model.requestTemplate || '{ "prompt": "{prompt}", "input": "{input}" }';
    
    // 使用安全的模板替换，使用处理后的文本
    requestBody = safeTemplateReplace(requestBody, {
      prompt,
      input: processedInput
    });
    
    // 解析JSON，使用安全的解析方法
    const parsedRequestBody = safeJsonParse(requestBody);
    
    // 添加随机性控制参数
    if (typeof parsedRequestBody === 'object') {
      // 设置默认值
      const temperature = options.temperature ?? 0.1;
      const topP = options.topP ?? 0.9;
      
      // 根据不同API格式适配参数
      if ('temperature' in parsedRequestBody) {
        parsedRequestBody.temperature = temperature;
      }
      if ('top_p' in parsedRequestBody) {
        parsedRequestBody.top_p = topP;
      }
      // 处理嵌套参数的情况
      if (parsedRequestBody.parameters) {
        parsedRequestBody.parameters.temperature = temperature;
        parsedRequestBody.parameters.top_p = topP;
      }
      
      console.log(`设置模型随机性参数: temperature=${temperature}, top_p=${topP}`);
    }
    
    // 如果配置了forceModelName，确保请求使用正确的model字段
    if (model.forceModelName && typeof parsedRequestBody === 'object') {
      // 处理不同格式的API请求
      if (parsedRequestBody.model) {
        parsedRequestBody.model = model.forceModelName;
      }
      // 针对不同API格式的适配
      if (parsedRequestBody.parameters && parsedRequestBody.parameters.model) {
        parsedRequestBody.parameters.model = model.forceModelName;
      }
      console.log(`强制使用模型名称: ${model.forceModelName}`);
    }
    
    // 如果模型支持流式输出，添加流式参数
    if (model.supportsStreaming && typeof parsedRequestBody === 'object') {
      parsedRequestBody.stream = true;
      
      // 对于OpenRouter特定参数处理
      if (model.baseUrl.includes('openrouter.ai')) {
        // OpenRouter可能需要特定的流式参数
        if (!parsedRequestBody.stream_options) {
          parsedRequestBody.stream_options = {};
        }
        // 对于QWQ模型特别添加stream_options参数
        if (model.forceModelName?.includes('qwen') || model.forceModelName?.includes('qwq')) {
          parsedRequestBody.stream_options.include_usage = true;
        }
      } else {
        // 对于QWQ模型特别添加stream_options参数
        if (model.forceModelName?.includes('qwq')) {
          parsedRequestBody.stream_options = {
            include_usage: true
          };
        }
      }
      
      console.log('启用流式输出');
    }
    
    // 构建请求配置
    const requestUrl = `${model.baseUrl}${model.requestPath || ''}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // 添加模型自定义头信息，并确保所有值都经过sanitizeHeaderValue处理
    if (model.headers) {
      Object.entries(model.headers).forEach(([key, value]) => {
        headers[key] = sanitizeHeaderValue(value);
      });
    }
    
    if (model.apiKey) {
      // 根据不同模型平台设置不同的Authorization格式
      if (model.baseUrl.includes('volces.com')) {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      } else if (model.baseUrl.includes('deepseek.com')) {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      } else if (model.baseUrl.includes('openai.com')) {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      } else if (model.baseUrl.includes('openrouter.ai')) {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
        // OpenRouter特定请求头 - 使用英文或编码后的值以避免非ASCII字符
        headers['HTTP-Referer'] = 'https://mars-ai-insights.com';
        headers['X-Title'] = sanitizeHeaderValue('Mars Model Evaluation Platform');
      } else {
        // 默认Bearer格式
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      }
    }
    
    // 发送请求前打印请求体以便调试
    console.log(`发送请求到模型 ${model.name}:`, JSON.stringify(parsedRequestBody, null, 2));
    
    // 根据是否流式输出使用不同的请求方式
    if (model.supportsStreaming) {
      // 流式输出处理 - 修改为使用axios的responseType: text
      const response = await axios.post(requestUrl, parsedRequestBody, {
        headers,
        responseType: 'text', // 使用text替代stream，让axios自动处理SSE流
      });
      
      let fullContent = '';
      let fullReasoningContent = '';
      let chunks: string[] = [];
      
      // 处理SSE流式响应
      if (typeof response.data === 'string') {
        chunks = response.data.split('\n');
        const validChunks = chunks.filter(chunk => chunk.trim() !== '');
        
        for (const chunk of validChunks) {
          try {
            const processedContent = processStreamChunk(chunk);
            if (processedContent) {
              if (processedContent.content) {
                fullContent += processedContent.content;
              }
              if (processedContent.reasoning_content) {
                fullReasoningContent += processedContent.reasoning_content;
              }
            }
          } catch (chunkError) {
            console.warn('处理单个块时出错，已跳过:', chunk);
            console.error(chunkError);
            // 跳过此块，继续处理下一个
            continue;
          }
        }
      }
      
      const responseTime = Date.now() - startTime;
      console.log('--------------------------------------------------------');
      console.log(`流式响应完成 - ${model.name}`);
      console.log(`请求耗时: ${responseTime}ms`);
      console.log('输入内容:', input.substring(0, 100) + (input.length > 100 ? '...' : ''));
      console.log('完整输出结果:');
      console.log(fullContent);
      if (fullReasoningContent) {
        console.log('推理过程:');
        console.log(fullReasoningContent);
      }
      console.log('--------------------------------------------------------');
      
      // 返回响应结果
      return {
        modelId: model.id,
        modelName: model.name,
        responseTime,
        content: fullContent,
        rawResponse: { 
          chunks, 
          rawStreaming: true,
          reasoningContent: fullReasoningContent || undefined 
        },
        processedInput: options.enablePreprocess ? processedInput : undefined
      };
    } else {
      // 非流式处理，保持原有逻辑
      const response = await axios.post(requestUrl, parsedRequestBody, { headers });
      
      // 计算响应时间
      const responseTime = Date.now() - startTime;
      
      // 提取响应内容
      let content = '';
      if (response.data) {
        try {
          // 尝试从响应中提取内容，这里需要针对不同的模型进行调整
          if (typeof response.data === 'string') {
            content = response.data;
          } else if (response.data.choices?.[0]?.message?.content) {
            // OpenAI 风格的响应
            content = response.data.choices[0].message.content;
          } else if (response.data.response) {
            // 通用格式
            content = response.data.response;
          } else if (response.data.output) {
            // 另一种通用格式
            content = response.data.output;
          } else if (response.data.text) {
            // Qwen等模型的格式
            content = response.data.text;
          } else if (response.data.choices?.[0]?.message?.content) {
            // 火山引擎豆包模型格式
            content = response.data.choices[0].message.content;
          } else {
            content = JSON.stringify(response.data);
          }
        } catch (error) {
          console.error('解析响应内容时出错:', error);
          content = '解析响应内容失败';
        }
      }
      
      // 记录实际使用的模型信息
      const actualModelInfo = {
        ...response.data,
        actualModelName: response.data?.model || model.forceModelName || '未知',
        requestedModelName: model.name
      };
      console.log(content);
      
      // 添加更详细的批处理结果日志
      console.log('--------------------------------------------------------');
      console.log(`批处理结果 - ${model.name}`);
      console.log(`请求耗时: ${responseTime}ms`);
      console.log('输入内容:', input.substring(0, 100) + (input.length > 100 ? '...' : ''));
      console.log('完整输出结果:');
      console.log(content);
      console.log('--------------------------------------------------------');
      
      return {
        modelId: model.id,
        modelName: model.name,
        responseTime,
        content,
        rawResponse: actualModelInfo,
        processedInput: options.enablePreprocess ? processedInput : undefined
      };
    }
  } catch (error: any) {
    console.error(`调用模型 ${model.name} 时出错:`, error);
    
    // 构建详细的错误信息
    let errorMessage = error.message || '未知错误';
    if (error.response) {
      // 服务器响应错误
      errorMessage = `服务器响应错误 (${error.response.status}): ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
      // 请求发送失败
      errorMessage = '无法连接到服务器，请检查网络或API地址';
    } else if (errorMessage.includes('setRequestHeader') && errorMessage.includes('code point')) {
      // 处理请求头编码错误
      errorMessage = '请求头包含不支持的字符，已自动修复，请重试请求';
      console.warn('检测到请求头编码问题，建议重试请求');
    }
    
    // 添加批处理错误日志
    console.log('--------------------------------------------------------');
    console.log(`批处理失败 - ${model.name}`);
    console.log('输入内容:', input.substring(0, 100) + (input.length > 100 ? '...' : ''));
    console.log('错误信息:', errorMessage);
    console.log('--------------------------------------------------------');
    
    return {
      modelId: model.id,
      modelName: model.name,
      responseTime: Date.now() - startTime,
      content: '',
      error: errorMessage,
      processedInput: options.enablePreprocess ? preprocessText(input) : undefined
    };
  }
};

export const callModelWithImage = async (
  model: Model,
  prompt: string,
  imageBase64: string,
  options: {
    temperature?: number;
    topP?: number;
  } = {}
): Promise<ModelResponse> => {
  const startTime = Date.now();
  
  try {
    // 构建请求体模板
    let requestBody = model.requestTemplate || 
      '{ "model": "{model}", "messages": [{"role": "user", "content": [{"type": "text", "text": "{prompt}"}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,{image}"}}]}], "stream": true }';
    
    // 替换模板变量
    requestBody = safeTemplateReplace(requestBody, {
      prompt,
      image: imageBase64,
      model: model.forceModelName || "qwen/qwen2.5-vl-32b-instruct:free"
    });
    
    // 解析JSON
    const parsedRequestBody = safeJsonParse(requestBody);
    
    // 添加随机性控制参数
    if (typeof parsedRequestBody === 'object') {
      // 设置默认值
      const temperature = options.temperature ?? 0.1;
      const topP = options.topP ?? 0.9;
      
      // 添加参数
      if ('temperature' in parsedRequestBody) {
        parsedRequestBody.temperature = temperature;
      }
      if ('top_p' in parsedRequestBody) {
        parsedRequestBody.top_p = topP;
      }
    }
    
    // 构建请求配置
    const requestUrl = `${model.baseUrl}${model.requestPath || ''}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // 添加模型自定义头信息
    if (model.headers) {
      Object.entries(model.headers).forEach(([key, value]) => {
        headers[key] = sanitizeHeaderValue(value);
      });
    }
    
    // 设置authorization
    if (model.apiKey) {
      if (model.baseUrl.includes('openrouter.ai')) {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
        headers['HTTP-Referer'] = 'https://mars-ai-insights.com';
        headers['X-Title'] = sanitizeHeaderValue('Mars Model Evaluation Platform');
      } else {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      }
    }
    
    console.log(`发送图像请求到模型 ${model.name}`);
    
    // 处理流式响应
    if (parsedRequestBody.stream) {
      const response = await axios.post(requestUrl, parsedRequestBody, {
        headers,
        responseType: 'text',
      });
      
      let fullContent = '';
      let chunks: string[] = [];
      
      if (typeof response.data === 'string') {
        chunks = response.data.split('\n');
        const validChunks = chunks.filter(chunk => chunk.trim() !== '');
        
        for (const chunk of validChunks) {
          try {
            const processedContent = processStreamChunk(chunk);
            if (processedContent && processedContent.content) {
              fullContent += processedContent.content;
            }
          } catch (chunkError) {
            console.warn('处理单个块时出错，已跳过:', chunk);
            continue;
          }
        }
      }
      
      const responseTime = Date.now() - startTime;
      console.log('--------------------------------------------------------');
      console.log(`图像分析完成 - ${model.name}`);
      console.log(`请求耗时: ${responseTime}ms`);
      console.log('提示词:', prompt);
      console.log('完整输出结果:');
      console.log(fullContent);
      console.log('--------------------------------------------------------');
      
      return {
        modelId: model.id,
        modelName: model.name,
        responseTime,
        content: fullContent,
        rawResponse: { chunks, rawStreaming: true }
      };
    } else {
      // 非流式处理
      const response = await axios.post(requestUrl, parsedRequestBody, { headers });
      const responseTime = Date.now() - startTime;
      
      let content = '';
      if (response.data) {
        try {
          if (response.data.choices?.[0]?.message?.content) {
            content = response.data.choices[0].message.content;
          } else if (response.data.choices?.[0]?.content) {
            content = response.data.choices[0].content;
          } else {
            content = JSON.stringify(response.data);
          }
        } catch (error) {
          console.error('解析响应内容时出错:', error);
          content = '解析响应内容失败';
        }
      }
      
      console.log('--------------------------------------------------------');
      console.log(`图像分析结果 - ${model.name}`);
      console.log(`请求耗时: ${responseTime}ms`);
      console.log('提示词:', prompt);
      console.log('完整输出结果:');
      console.log(content);
      console.log('--------------------------------------------------------');
      
      return {
        modelId: model.id,
        modelName: model.name,
        responseTime,
        content,
        rawResponse: response.data
      };
    }
  } catch (error: any) {
    console.error(`图像处理时出错 ${model.name}:`, error);
    
    let errorMessage = error.message || '未知错误';
    if (error.response) {
      errorMessage = `服务器响应错误 (${error.response.status}): ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
      errorMessage = '无法连接到服务器，请检查网络或API地址';
    }
    
    console.log('--------------------------------------------------------');
    console.log(`图像处理失败 - ${model.name}`);
    console.log('错误信息:', errorMessage);
    console.log('--------------------------------------------------------');
    
    return {
      modelId: model.id,
      modelName: model.name,
      responseTime: Date.now() - startTime,
      content: '',
      error: errorMessage
    };
  }
};