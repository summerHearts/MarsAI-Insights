/**
 * 文本预处理工具类
 * 用于在API调用前对文本进行清理和格式化
 */

/**
 * 去除文本中的时间戳格式 [H::M::S-H::M::S]
 * @param text 原始文本
 * @returns 处理后的文本
 */
export const removeTimestamps = (text: string): string => {
  // 匹配时间戳格式 [数字::数字::数字-数字::数字::数字]
  const pattern = /\[\d+::\d+::\d+-\d+::\d+::\d+\]/g;
  return text.replace(pattern, '');
};

/**
 * 获取角色的标准映射名称
 * 支持完整匹配和前缀匹配，例如"司机"和"机"都能映射到"司机"
 * @param speaker 原始角色名
 * @param speakerMap 角色映射配置
 * @returns 映射后的标准角色名
 */
const getMappedSpeaker = (speaker: string, speakerMap: Record<string, string>): string => {
  // 1. 完全匹配
  if (speakerMap[speaker]) {
    return speakerMap[speaker];
  }
  
  // 2. 检查是否是某个角色的后缀
  for (const [key, value] of Object.entries(speakerMap)) {
    if (key.endsWith(speaker)) {
      return value;
    }
  }
  
  // 3. 返回原始角色名
  return speaker;
};

/**
 * 角色增强处理，将原始文本中的角色标识转换为结构化的角色对话
 * 支持格式如: 
 * 1. 司机[0:7:480-0:10:680]:接下了...
 * 2. 司机:喂，你那是什么货啊
 * 3. 机:喂，你好 （简写的角色名）
 * @param text 原始文本
 * @param defaultSpeakerMap 角色映射配置，用于将原文中的角色名映射为标准角色名
 * @returns 结构化后的文本
 */
export const enhanceRoles = (
  text: string, 
  defaultSpeakerMap: Record<string, string> = {
    "司机": "司机",
    "用户": "用户"
  }
): string => {
  let result = text;
  let matches = [];

  // 调试信息
  console.log('输入文本:', text);

  // 首先检查是否已经是JSON格式
  try {
    const jsonData = JSON.parse(text);
    if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].角色) {
      // 已经是JSON格式，只需处理角色映射
      const processedData = jsonData.map(item => {
        const mappedSpeaker = getMappedSpeaker(item.角色, defaultSpeakerMap);
        return {
          ...item,
          角色: mappedSpeaker
        };
      });
      return JSON.stringify(processedData, null, 2);
    }
  } catch (e) {
    // 不是JSON格式，继续处理
  }

  // 尝试匹配带时间戳的格式 - 同时支持单冒号和双冒号格式
  // 修复正则表达式，使其能够正确匹配所有行，包括多行内容
  // 使用 [^]*? 而不是 .*? 可以匹配包括换行符在内的所有字符
  const timestampPattern = /([\u4e00-\u9fa5]+)(?:\[\d+:{1,2}\d+:{1,2}\d+-\d+:{1,2}\d+:{1,2}\d+\]):([^]*?)(?=(?:[\u4e00-\u9fa5]+\[\d+:{1,2}\d+:{1,2}\d+-\d+:{1,2}\d+:{1,2}\d+\]:)|$)/g;
  
  let matchWithTimestamp;
  while ((matchWithTimestamp = timestampPattern.exec(text)) !== null) {
    if (matchWithTimestamp.length >= 3) {
      const speaker = matchWithTimestamp[1].trim();
      const content = matchWithTimestamp[2].trim();
      const mappedSpeaker = getMappedSpeaker(speaker, defaultSpeakerMap);
      
      console.log('匹配到带时间戳的对话:', { speaker, content, mappedSpeaker });
      
      matches.push({
        speaker: mappedSpeaker,
        content
      });
    }
  }

  // 如果没有找到带时间戳的匹配，尝试普通的角色:内容格式
  if (matches.length === 0) {
    console.log('没有找到带时间戳的对话，尝试普通格式');
    
    // 修改正则表达式以处理各种长度的角色名
    // 将文本按照"某某:"模式分割
    const rolePattern = /(?=[\u4e00-\u9fa5]{1,5}:)/; // 调整为匹配1-5个中文字符
    const parts = text.split(rolePattern);
    
    for (const part of parts) {
      const match = part.match(/^([\u4e00-\u9fa5]{1,5}):(.*)$/); // 适配更长的角色名
      if (match && match.length >= 3) {
        const speaker = match[1].trim();
        let content = match[2].trim();
        
        // 清理内容中的问号和多余空格
        content = content.replace(/\?\s+/g, '? ').trim();
        
        const mappedSpeaker = getMappedSpeaker(speaker, defaultSpeakerMap);
        
        console.log('匹配到普通格式的对话:', { speaker, content, mappedSpeaker });
        
        matches.push({
          speaker: mappedSpeaker,
          content
        });
      }
    }
  }
  
  // 如果找到匹配项，则将文本转换为JSON结构
  if (matches.length > 0) {
    console.log('找到对话匹配项数量:', matches.length);
    
    // 生成结构化文本
    const structuredText = matches.map(m => {
      // 过滤内容中的特殊字符和转义双引号
      const cleanContent = m.content
        .replace(/"/g, '\\"')        // 转义双引号
        .replace(/[\b]/g, '')        // 移除退格字符
        .replace(/\\b\d+\\b/g, '')   // 移除\b0\b类似的字符组合
        .replace(/\\bOKOK\\b/g, 'OK') // 处理OKOK特殊情况
        .replace(/\?+/g, '?')        // 将多个问号替换为单个
        .trim();
      
      return `{"角色": "${m.speaker}", "内容": "${cleanContent}"}`;
    }).join(',\n');
    
    result = `[\n${structuredText}\n]`;
  }
  
  console.log('处理后的结果:', result);
  return result;
};

/**
 * 角色增强预处理 - 按时间顺序整理对话
 * 首先移除时间戳，然后将对话转换为结构化格式
 * @param text 原始文本
 * @param speakerMap 角色映射配置
 * @returns 结构化后的对话
 */
export const processConversation = (
  text: string, 
  speakerMap?: Record<string, string>
): string => {
  // 首先使用增强角色功能处理文本
  return enhanceRoles(text, speakerMap);
};

/**
 * 去除文本中的HTML标签
 * @param text 原始文本
 * @returns 处理后的文本
 */
export const removeHtmlTags = (text: string): string => {
  return text.replace(/<[^>]*>/g, '');
};

/**
 * 去除多余的空白字符（空格、换行等）
 * @param text 原始文本
 * @returns 处理后的文本
 */
export const normalizeWhitespace = (text: string): string => {
  // 将连续的空白字符替换为单个空格
  return text.replace(/\s+/g, ' ').trim();
};

/**
 * 去除特定的数据标记，如[DATA]、<DATA>等
 * @param text 原始文本
 * @param patterns 要移除的模式数组，默认为空数组
 * @returns 处理后的文本
 */
export const removeDataMarkers = (text: string, patterns: string[] = []): string => {
  let result = text;
  const defaultPatterns = [/\[DATA\]/g, /<DATA>/g, /\{DATA\}/g];
  
  // 应用默认模式
  for (const pattern of defaultPatterns) {
    result = result.replace(pattern, '');
  }
  
  // 应用用户提供的自定义模式
  for (const patternStr of patterns) {
    try {
      const pattern = new RegExp(patternStr, 'g');
      result = result.replace(pattern, '');
    } catch (error) {
      console.error(`创建正则表达式"${patternStr}"失败:`, error);
    }
  }
  
  return result;
};

/**
 * 应用多个文本处理函数
 * @param text 原始文本
 * @param processors 处理函数数组
 * @returns 处理后的文本
 */
export const applyProcessors = (text: string, processors: ((text: string) => string)[]): string => {
  return processors.reduce((processedText, processor) => processor(processedText), text);
};

/**
 * 预设的文本处理组合
 */
export const textProcessorPresets = {
  /**
   * 基础清理: 去除时间戳和多余空白字符
   */
  basic: (text: string): string => {
    return applyProcessors(text, [
      removeTimestamps,
      normalizeWhitespace
    ]);
  },
  
  /**
   * 完整清理: 去除时间戳、HTML标签和多余空白字符
   */
  complete: (text: string): string => {
    return applyProcessors(text, [
      removeTimestamps,
      removeHtmlTags,
      normalizeWhitespace
    ]);
  },
  
  /**
   * 对话结构化: 将原始对话文本转换为结构化JSON格式
   */
  conversation: (text: string): string => {
    return processConversation(text);
  }
}; 