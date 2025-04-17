import axios from 'axios';

export interface FeishuConfig {
  webhook?: string;
  secret?: string;
  enabled: boolean;
}

export interface FeishuMessage {
  title: string;
  content: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

/**
 * 计算飞书签名
 * @param timestamp 当前时间戳
 * @param secret 飞书机器人密钥
 * @returns 签名
 */
const generateSign = (timestamp: number, secret: string): string => {
  const stringToSign = `${timestamp}\n${secret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  
  // 使用SubtleCrypto计算HMAC-SHA256签名
  return crypto.subtle.digest('SHA-256', data)
    .then(hashBuffer => {
      // 将ArrayBuffer转为Base64
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return btoa(hashHex);
    })
    .catch(error => {
      console.error('生成飞书签名失败:', error);
      return '';
    }) as unknown as string;
};

/**
 * 发送飞书消息
 * @param config 飞书配置
 * @param message 消息内容
 * @returns 是否发送成功
 */
export const sendFeishuMessage = async (
  config: FeishuConfig, 
  message: FeishuMessage
): Promise<boolean> => {
  try {
    if (!config.enabled || !config.webhook) {
      console.log('飞书通知未启用或未配置Webhook');
      return false;
    }

    // 构建飞书卡片消息
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 根据状态设置不同的颜色
    const statusColorMap = {
      'success': 'green',
      'warning': 'yellow',
      'error': 'red',
      'info': 'blue'
    };

    const cardData = {
      timestamp,
      sign: config.secret ? await generateSign(timestamp, config.secret) : undefined,
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: message.title || '模型评测通知'
          },
          template: statusColorMap[message.status] || 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: message.content
            }
          },
          {
            tag: 'hr'
          },
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content: `发送时间: ${new Date().toLocaleString()}`
              }
            ]
          }
        ]
      }
    };

    // 发送请求
    const response = await axios.post(config.webhook, cardData, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.status === 200 && response.data?.code === 0) {
      console.log('飞书消息发送成功');
      return true;
    } else {
      console.error('飞书消息发送失败:', response.data);
      return false;
    }
  } catch (error) {
    console.error('发送飞书消息时出错:', error);
    return false;
  }
};

/**
 * 测试飞书配置是否有效
 * @param config 飞书配置
 * @returns 测试结果
 */
export const testFeishuConfig = async (config: FeishuConfig): Promise<{success: boolean; message: string}> => {
  try {
    if (!config.webhook) {
      return { success: false, message: '请填写Webhook地址' };
    }

    const testMessage: FeishuMessage = {
      title: '测试消息',
      content: '这是一条测试消息，如果您收到了这条消息，说明飞书配置成功了。',
      status: 'info'
    };

    const success = await sendFeishuMessage(config, testMessage);
    
    if (success) {
      return { success: true, message: '测试成功！已发送测试消息到飞书' };
    } else {
      return { success: false, message: '测试失败，请检查Webhook地址和密钥是否正确' };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `测试出错: ${error instanceof Error ? error.message : '未知错误'}` 
    };
  }
}; 