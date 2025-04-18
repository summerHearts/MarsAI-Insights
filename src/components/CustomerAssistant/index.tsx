import React, { useState, useEffect, useCallback, useRef, memo, forwardRef } from 'react';
import Chat, { Bubble, useMessages, Card, List, ListItem, SystemMessage } from '@chatui/core';
import '@chatui/core/dist/index.css';
import { CustomerServiceOutlined, UserOutlined, RocketOutlined, StarOutlined, ClockCircleOutlined, CloseOutlined } from '@ant-design/icons';
import OrderCard, { OrderProduct } from './OrderCard';
import { ImageMessage, ImageWithText } from './ImageMessage';

// 导入拆分后的CSS文件
import './styles/container.css';
import './styles/button.css';
import './styles/chat.css';
import './styles/messages.css';
import './styles/system-message.css';
import './styles/quick-replies.css';
import './styles/card.css';
import './styles/product-card.css';
import './styles/order-card.css';
import './styles/animations.css';
import './styles/image-message.css';
import './styles/image-preview.css';

// 定义常见问题列表
const commonQuestions = [
  {
    id: '1',
    title: '如何使用模型比较功能？',
    answer: '在"模型比较"标签页，您可以选择要比较的模型，输入提示词和测试内容，然后点击"比较"按钮即可查看不同模型的输出结果。'
  },
  {
    id: '2',
    title: '如何保存比较结果？',
    answer: '比较完成后，点击结果区域右上角的"保存结果"按钮，为结果命名后即可保存到"历史记录"中查看。'
  },
  {
    id: '3',
    title: '如何批量处理数据？',
    answer: '在"批量数据评测"标签页，您可以上传Excel文件或直接输入测试数据，选择模型和提示词模板，然后点击"开始处理"按钮。'
  },
  {
    id: '4',
    title: '支持哪些类型的模型？',
    answer: '目前支持各种主流大型语言模型，包括OpenAI的GPT系列、阿里云的通义千问系列、火山引擎的豆包系列等，您可以在"模型配置"中查看和添加。'
  },
  {
    id: '5',
    title: '如何创建自定义提示词模板？',
    answer: '在"提示词模板"标签页，点击"创建新模板"按钮，填写标题、描述和提示词内容，然后保存即可。'
  }
];

// 定义产品展示卡片数据
const productCards = [
  {
    id: 'model-comparison',
    title: '模型比较',
    description: '比较不同模型在相同输入下的表现差异',
    imageUrl: 'https://img.icons8.com/color/96/000000/compare.png',
    actions: [
      { name: '立即使用', value: 'use-model-comparison' },
      { name: '了解更多', value: 'learn-model-comparison' }
    ]
  },
  {
    id: 'batch-processing',
    title: '批量数据评测',
    description: '通过Excel处理大量数据样本，效率提升10倍',
    imageUrl: 'https://img.icons8.com/color/96/000000/data-sheet.png',
    actions: [
      { name: '立即使用', value: 'use-batch-processing' },
      { name: '查看演示', value: 'demo-batch-processing' }
    ]
  },
  {
    id: 'image-analysis',
    title: '图像分析',
    description: '支持多模态模型评测图像理解能力',
    imageUrl: 'https://img.icons8.com/color/96/000000/image.png',
    actions: [
      { name: '开始评测', value: 'use-image-analysis' }
    ]
  }
];

// 定义快速回复选项
const quickReplies = [
  {
    name: '功能介绍',
    code: 'products',
    icon: 'message'
  },
  {
    name: '使用指南',
    code: 'guide',
    icon: 'message'
  },
  {
    name: '查询订单',
    code: 'orders',
    icon: 'message'
  },
  {
    name: '评测演示',
    code: 'demo',
    icon: 'picture'
  },
  {
    name: '联系我们',
    code: 'contact',
    icon: 'message'
  }
];

// 模拟API请求延迟
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 格式化时间戳
const formatTime = () => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

interface CustomerAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

// 定义头像常量
const ASSISTANT_AVATAR = '/assets/kefu.png';
const USER_AVATAR = '/assets/user.png';

// 模拟获取回复函数
const getResponse = (question: string): string => {
  // 简单模拟响应，实际应用中可替换为API调用
  const responses = {
    '你好': '您好！有什么我可以帮助您的吗？',
    '你是谁': '我是您的智能客服助手，随时为您提供帮助。',
    '谢谢': '不客气，很高兴能帮到您！',
  };
  
  // 查找匹配的关键词回复
  for (const key in responses) {
    if (question.includes(key)) {
      return responses[key as keyof typeof responses];
    }
  }
  
  // 默认回复
  return '感谢您的咨询，我们会尽快处理您的问题！';
};

// 滚动处理辅助组件
const ScrollFixer = forwardRef((props: {children: React.ReactNode, onScroll?: (e: React.UIEvent) => void}, ref: React.Ref<HTMLDivElement>) => {
  const innerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (innerRef.current && typeof ref === 'function') {
      ref(innerRef.current);
    } else if (ref && 'current' in ref && innerRef.current) {
      (ref as React.MutableRefObject<HTMLDivElement>).current = innerRef.current;
    }
  }, [ref]);
  
  return (
    <div 
      ref={innerRef} 
      className="scroll-fixer"
      style={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onScroll={props.onScroll}
    >
      {props.children}
    </div>
  );
});

const CustomerAssistant: React.FC<CustomerAssistantProps> = memo(({ isOpen, onClose }) => {
  // 使用ChatUI的useMessages钩子管理消息
  const { messages, appendMsg } = useMessages([]);
  const [isTyping, setIsTyping] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  
  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // 优化滚动事件处理 - 彻底阻止事件穿透
  useEffect(() => {
    if (!isOpen) return;

    const preventBubbling = (e: Event) => {
      e.stopPropagation();
    };
    
    const preventScroll = (e: TouchEvent) => {
      // 检查是否在消息容器内
      const messageContainer = chatContainerRef.current?.querySelector('.MessageContainer');
      if (messageContainer && e.target && messageContainer.contains(e.target as Node)) {
        // 不阻止默认行为，允许内部滚动
      } else if (chatContainerRef.current?.contains(e.target as Node)) {
        // 在聊天容器内但不在消息容器内的触摸事件，阻止默认行为
        e.preventDefault();
      }
    };

    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      // 为容器添加所有相关事件监听器
      chatContainer.addEventListener('wheel', preventBubbling, { passive: false });
      chatContainer.addEventListener('touchstart', preventBubbling, { passive: false });
      chatContainer.addEventListener('touchmove', preventScroll, { passive: false });
      chatContainer.addEventListener('mousewheel', preventBubbling, { passive: false });
    }

    return () => {
      if (chatContainer) {
        // 移除所有事件监听器
        chatContainer.removeEventListener('wheel', preventBubbling);
        chatContainer.removeEventListener('touchstart', preventBubbling);
        chatContainer.removeEventListener('touchmove', preventScroll);
        chatContainer.removeEventListener('mousewheel', preventBubbling);
      }
    };
  }, [isOpen]);

  // 自动滚动到底部 - 使用ResizeObserver和MutationObserver确保滚动更可靠
  useEffect(() => {
    if (!isOpen || !messageContainerRef.current) return;
    
    const scrollToBottom = () => {
      if (messageContainerRef.current) {
        // 添加延迟以确保DOM已完全更新
        requestAnimationFrame(() => {
          if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
            
            // iOS设备上可能需要额外滚动
            setTimeout(() => {
              if (messageContainerRef.current) {
                messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
              }
            }, 100);
          }
        });
      }
    };
    
    // 初始滚动
    scrollToBottom();
    
    // 监听内容变化
    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom();
    });
    
    const mutationObserver = new MutationObserver(() => {
      scrollToBottom();
    });
    
    // 添加滚动事件监听，解决iOS上的滚动问题
    const messageContainer = messageContainerRef.current;
    
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // 允许消息容器内的滚动
      if (messageContainer && messageContainer.contains(target)) {
        e.stopPropagation();
      }
    };
    
    if (messageContainer) {
      resizeObserver.observe(messageContainer);
      mutationObserver.observe(messageContainer, {
        childList: true,
        subtree: true
      });
      
      messageContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    }
    
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (messageContainer) {
        messageContainer.removeEventListener('touchstart', handleTouchStart);
      }
    };
  }, [isOpen, messages.length]);

  // 初始化欢迎消息
  useEffect(() => {
    if (isOpen && !initialized) {
      // 添加系统消息作为欢迎
      appendMsg({
        type: 'system',
        content: { text: '欢迎使用Mars模型评测平台智能助手' },
        position: 'center', // 明确指定位置为居中
      });
      
      // 添加助手欢迎消息
      appendMsg({
        type: 'text',
        content: { 
          text: '您好，我是Mars模型评测平台的智能助手！您可以向我咨询关于平台使用的任何问题，或者点击下方的快速回复选项。',
          time: formatTime() 
        },
        user: { avatar: ASSISTANT_AVATAR },
      });
      
      // 延迟显示常见问题卡片，使对话更自然
      setTimeout(() => {
        appendMsg({
          type: 'card',
          content: {
            code: 'faq-intro',
            title: '您可能想了解的问题',
            items: commonQuestions.slice(0, 3).map(q => ({
              id: q.id,
              title: q.title,
            })),
            time: formatTime()
          },
          user: { avatar: ASSISTANT_AVATAR },
        });
      }, 600);
      
      setInitialized(true);
    }
    
    if (!isOpen) {
      // 当关闭时重置初始化状态，以便下次打开时重新初始化
      setInitialized(false);
    }
  }, [isOpen, initialized, appendMsg]);

  // 处理发送消息
  const handleSend = useCallback((type: string, val: string) => {
    if (type === 'text' && val.trim()) {
      // 添加用户消息
      appendMsg({
        type: 'text',
        content: { 
          text: val,
          time: formatTime() 
        },
        position: 'right',
        user: { avatar: USER_AVATAR },
      });

      // 模拟回复中状态
      setIsTyping(true);
      
      // 处理图片相关关键词
      if (val.toLowerCase().includes('图片') || val.toLowerCase().includes('截图') || val.toLowerCase().includes('照片')) {
        setTimeout(() => {
          // 发送图片消息
          appendMsg({
            type: 'image',
            content: {
              src: 'https://ai-sample.oss-cn-hangzhou.aliyuncs.com/model_comparison.png',
              alt: '模型比较示例',
              caption: '模型评测对比结果示例',
              time: formatTime()
            },
            user: { avatar: ASSISTANT_AVATAR },
          });
          
          // 延迟发送图文混排消息
          setTimeout(() => {
            appendMsg({
              type: 'image-with-text',
              content: {
                src: 'https://ai-sample.oss-cn-hangzhou.aliyuncs.com/llm_benchmark.png',
                text: '上图展示了我们平台支持的主流大语言模型性能对比基准测试结果。您可以在我们的平台上轻松进行类似的模型评测和数据分析。',
                layout: 'top',
                time: formatTime()
              },
              user: { avatar: ASSISTANT_AVATAR },
            });
            
            setIsTyping(false);
          }, 800);
        }, 1000);
        return;
      }
      
      // 处理特殊指令
      if (val.toLowerCase().includes('产品') || val.toLowerCase().includes('功能')) {
        setTimeout(() => {
          appendMsg({
            type: 'text',
            content: { 
              text: '以下是我们的主要评测功能，您可以点击了解详情:',
              time: formatTime()
            },
            user: { avatar: ASSISTANT_AVATAR },
          });
          
          // 发送产品卡片
          setTimeout(() => {
            appendMsg({
              type: 'product-card',
              content: {
                items: productCards,
                time: formatTime()
              },
              user: { avatar: ASSISTANT_AVATAR },
            });
            
            setIsTyping(false);
          }, 400);
        }, 800);
        return;
      }
      
      // 订单查询关键词检测
      if (val.toLowerCase().includes('订单') || val.toLowerCase().includes('物流') || 
          val.toLowerCase().includes('购买历史') || val.toLowerCase().includes('我买的')) {
        setTimeout(() => {
          appendMsg({
            type: 'text',
            content: { 
              text: '您好，以下是您近期的订单信息:',
              time: formatTime()
            },
            user: { avatar: ASSISTANT_AVATAR },
          });
          
          // 发送订单卡片
          setTimeout(() => {
            // 示例订单数据
            const exampleOrder = {
              id: 'ORD' + Math.floor(Math.random() * 10000000).toString().padStart(8, '0'),
              status: 'shipped',
              createTime: new Date().toLocaleString('zh-CN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }),
              products: [
                {
                  id: 'PROD001',
                  name: 'AI评测高级套餐',
                  price: 299.00,
                  quantity: 1,
                  specs: '企业版/1年'
                },
                {
                  id: 'PROD002',
                  name: '模型评测加速包',
                  price: 99.00,
                  quantity: 2,
                  specs: '10次评测/包'
                }
              ],
              totalAmount: 497.00
            };
            
            appendMsg({
              type: 'order-card',
              content: {
                order: exampleOrder,
                time: formatTime()
              },
              user: { avatar: ASSISTANT_AVATAR },
            });
            
            setIsTyping(false);
          }, 600);
        }, 800);
        return;
      }
      
      // 根据消息长度计算模拟延迟时间，让回复更自然
      const delayTime = Math.min(1500, 500 + val.length * 30);
      
      // 模拟延迟回复
      setTimeout(() => {
        appendMsg({
          type: 'text',
          content: { 
            text: getResponse(val),
            time: formatTime() 
          },
          position: 'left', // 明确指定位置为左侧
          user: { avatar: ASSISTANT_AVATAR },
        });
        setIsTyping(false);
      }, delayTime);
    }
  }, [appendMsg]);

  // 处理快速回复点击
  const handleQuickReplyClick = useCallback((reply: any) => {
    if (reply.code === 'products') {
      // 添加用户消息
      appendMsg({
        type: 'text',
        content: { 
          text: '产品展示',
          time: formatTime() 
        },
        position: 'right',
        user: { avatar: USER_AVATAR },
      });
      
      // 模拟回复中状态
      setIsTyping(true);
      
      setTimeout(() => {
        appendMsg({
          type: 'text',
          content: { 
            text: '以下是我们的主要评测功能，您可以点击了解详情:',
            time: formatTime() 
          },
          user: { avatar: ASSISTANT_AVATAR },
        });
        
        // 发送产品卡片前的短暂延迟
        setTimeout(() => {
          appendMsg({
            type: 'product-card',
            content: {
              items: productCards,
              time: formatTime()
            },
            user: { avatar: ASSISTANT_AVATAR },
          });
          
          setIsTyping(false);
        }, 400);
      }, 800);
    } else if (reply.code === 'orders') {
      // 添加用户消息
      appendMsg({
        type: 'text',
        content: { 
          text: '查询我的订单',
          time: formatTime() 
        },
        position: 'right',
        user: { avatar: USER_AVATAR },
      });
      
      // 模拟回复中状态
      setIsTyping(true);
      
      setTimeout(() => {
        appendMsg({
          type: 'text',
          content: { 
            text: '您好，以下是您近期的订单信息:',
            time: formatTime() 
          },
          user: { avatar: ASSISTANT_AVATAR },
        });
        
        // 发送订单卡片前的短暂延迟
        setTimeout(() => {
          // 示例订单数据
          const exampleOrder = {
            id: 'ORD' + Math.floor(Math.random() * 10000000).toString().padStart(8, '0'),
            status: 'shipped',
            createTime: new Date().toLocaleString('zh-CN', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }),
            products: [
              {
                id: 'PROD001',
                name: 'AI评测高级套餐',
                price: 299.00,
                quantity: 1,
                specs: '企业版/1年'
              },
              {
                id: 'PROD002',
                name: '模型评测加速包',
                price: 99.00,
                quantity: 2,
                specs: '10次评测/包'
              }
            ],
            totalAmount: 497.00
          };
          
          appendMsg({
            type: 'order-card',
            content: {
              order: exampleOrder,
              time: formatTime()
            },
            user: { avatar: ASSISTANT_AVATAR },
          });
          
          setIsTyping(false);
        }, 600);
      }, 800);
    } else if (reply.code === 'demo') {
      // 添加用户消息
      appendMsg({
        type: 'text',
        content: { 
          text: '查看评测演示',
          time: formatTime() 
        },
        position: 'right',
        user: { avatar: USER_AVATAR },
      });
      
      // 模拟回复中状态
      setIsTyping(true);
      
      setTimeout(() => {
        appendMsg({
          type: 'text',
          content: { 
            text: '以下是我们平台的评测演示示例:',
            time: formatTime() 
          },
          user: { avatar: ASSISTANT_AVATAR },
        });
        
        // 发送单张图片
        setTimeout(() => {
          appendMsg({
            type: 'image',
            content: {
              src: 'https://t7.baidu.com/it/u=1567810714,42688486&fm=193&f=GIF',
              alt: '模型比较示例',
              caption: '模型评测结果可视化展示',
              time: formatTime()
            },
            user: { avatar: ASSISTANT_AVATAR },
          });
          
          // 发送左侧图文混排
          setTimeout(() => {
            appendMsg({
              type: 'image-with-text',
              content: {
                src: 'https://t7.baidu.com/it/u=2775453412,3865070165&fm=193&f=GIF',
                text: '我们的平台支持多种主流大语言模型的性能对比测试。上图展示了不同模型在标准基准测试中的表现。您可以看到，在多项指标上，GPT-4和Claude 3具有明显优势。',
                layout: 'left',
                time: formatTime()
              },
              user: { avatar: ASSISTANT_AVATAR },
            });
            
            // 发送右侧图文混排
            setTimeout(() => {
              appendMsg({
                type: 'image-with-text',
                content: {
                  src: 'https://t7.baidu.com/it/u=977771457,2732388148&fm=193&f=GIF',
                  text: '批量测试功能允许您一次性评估多个样本，快速获得全面的评测报告。您可以通过Excel文件上传批量数据，或使用我们的API进行自动化测试。',
                  layout: 'right',
                  time: formatTime()
                },
                user: { avatar: ASSISTANT_AVATAR },
              });
              
              // 发送顶部图文混排
              setTimeout(() => {
                appendMsg({
                  type: 'image-with-text',
                  content: {
                    src: 'https://t7.baidu.com/it/u=2420731103,3883209066&fm=193&f=GIF',
                    text: '评测报告提供了详细的分析结果，包括响应质量、响应时间、一致性评分等多维度指标。您可以根据这些指标选择最适合您业务需求的模型。',
                    layout: 'top',
                    time: formatTime()
                  },
                  user: { avatar: ASSISTANT_AVATAR },
                });
                
                setIsTyping(false);
              }, 1000);
            }, 1000);
          }, 1000);
        }, 600);
      }, 800);
    } else {
      handleSend('text', reply.name);
    }
  }, [handleSend, appendMsg]);

  // 处理卡片点击
  const handleCardClick = useCallback((item: any) => {
    // 模拟用户点击问题
    appendMsg({
      type: 'text',
      content: { 
        text: item.title,
        time: formatTime() 
      },
      position: 'right', // 明确指定位置为右侧
      user: { avatar: USER_AVATAR },
    });

    // 模拟回复中状态
    setIsTyping(true);
    
    // 模拟延迟回复
    setTimeout(() => {
      const response = commonQuestions.find(q => q.id === item.id)?.answer || '抱歉，没有找到相关回答';
      appendMsg({
        type: 'text',
        content: { 
          text: response,
          time: formatTime() 
        },
        position: 'left', // 明确指定位置为左侧
        user: { avatar: ASSISTANT_AVATAR },
      });
      setIsTyping(false);
    }, 1000);
  }, [appendMsg]);

  // 处理产品卡片操作点击
  const handleProductAction = useCallback((productId: string, action: string) => {
    console.log('Product action clicked:', productId, action);
    
    // 在实际应用中可以根据不同产品和操作执行不同的逻辑
    appendMsg({
      type: 'text',
      content: { 
        text: `您选择了${action}，稍后将会有专业顾问联系您。`,
        time: formatTime() 
      },
      user: { avatar: ASSISTANT_AVATAR },
    });
  }, [appendMsg]);

  // 处理查看订单详情
  const handleOrderDetail = useCallback((orderId: string) => {
    console.log('查看订单详情:', orderId);
    
    appendMsg({
      type: 'text',
      content: { 
        text: `您正在查看订单 #${orderId.slice(-8)} 的详细信息，这里是订单的完整明细...`,
        time: formatTime() 
      },
      user: { avatar: ASSISTANT_AVATAR },
    });
  }, [appendMsg]);
  
  // 处理订单物流跟踪
  const handleOrderTrack = useCallback((orderId: string) => {
    console.log('跟踪订单物流:', orderId);
    
    appendMsg({
      type: 'text',
      content: { 
        text: `订单 #${orderId.slice(-8)} 物流信息：\n已从杭州发出，预计3-5个工作日送达。`,
        time: formatTime() 
      },
      user: { avatar: ASSISTANT_AVATAR },
    });
  }, [appendMsg]);

  // 处理图片点击，打开预览
  const handleImageClick = useCallback((src: string) => {
    setPreviewImage(src);
  }, []);
  
  // 关闭图片预览
  const handleClosePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  // 自定义渲染消息内容
  const renderMessageContent = useCallback((msg: any) => {
    const { type, content } = msg;
    
    // 处理文本消息
    if (type === 'text') {
      return (
        <div className="message-wrapper">
          <Bubble content={content.text} />
        </div>
      );
    }
    
    // 处理系统消息
    if (type === 'system') {
      return <SystemMessage content={content.text} />;
    }
    
    // 处理图片消息
    if (type === 'image') {
      return (
        <div className="message-wrapper">
          <ImageMessage 
            src={content.src} 
            alt={content.alt} 
            caption={content.caption}
            onClick={handleImageClick}
          />
        </div>
      );
    }
    
    // 处理图文混排消息
    if (type === 'image-with-text') {
      return (
        <div className="message-wrapper">
          <ImageWithText 
            src={content.src} 
            alt={content.alt || '图片'} 
            text={content.text}
            layout={content.layout || 'left'}
            onClick={handleImageClick}
          />
        </div>
      );
    }
    
    // 处理常见问题卡片消息
    if (type === 'card') {
      const { title, items } = content;
      return (
        <div className="card-wrapper">
          <Card size="sm">
            <div className="custom-card-content">
              <h4>{title}</h4>
              <List>
                {items.map((item: any) => (
                  <ListItem 
                    key={item.id} 
                    content={item.title} 
                    onClick={() => handleCardClick(item)}
                  />
                ))}
              </List>
            </div>
          </Card>
        </div>
      );
    }
    
    // 处理订单卡片消息
    if (type === 'order-card') {
      const { order } = content;
      return (
        <div className="order-card-wrapper">
          <OrderCard
            orderId={order.id}
            status={order.status}
            createTime={order.createTime}
            products={order.products}
            totalAmount={order.totalAmount}
            onViewDetail={(orderId) => handleOrderDetail(orderId)}
            onTrack={(orderId) => handleOrderTrack(orderId)}
          />
        </div>
      );
    }
    
    // 处理产品卡片消息
    if (type === 'product-card') {
      const { items } = content;
      return (
        <div className="product-cards-wrapper">
          <div className="product-cards-container">
            {items.map((product: any, index: number) => (
              <div key={product.id} className="product-card" style={{ animationDelay: `${index * 0.2}s` }}>
                <div className="product-card-header">
                  <div className="product-card-icon">
                    {product.id === 'model-comparison' ? <RocketOutlined /> : 
                     product.id === 'batch-processing' ? <StarOutlined /> : 
                     <CustomerServiceOutlined />}
                  </div>
                  <h4 className="product-card-title">{product.title}</h4>
                </div>
                <div className="product-card-content">
                  <p>{product.description}</p>
                </div>
                <div className="product-card-actions">
                  {product.actions.map((action: any, index: number) => (
                    <button 
                      key={index} 
                      className="product-card-action-btn"
                      onClick={() => handleProductAction(product.id, action.value)}
                    >
                      {action.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  }, [handleCardClick, handleProductAction, handleOrderDetail, handleOrderTrack, handleImageClick]);
  
  // 处理消息容器的引用获取
  const handleChatRef = useCallback((node: any) => {
    if (node) {
      const messageContainer = node.querySelector('.MessageContainer');
      if (messageContainer) {
        messageContainerRef.current = messageContainer;
      }
    }
  }, []);

  // 处理关闭聊天窗口
  const handleCloseChat = useCallback(() => {
    onClose();
  }, [onClose]);

  // 阻止事件冒泡，但允许内部点击
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="customer-assistant-container"
      onClick={handleContainerClick}
      ref={chatContainerRef}
    >
      <ScrollFixer ref={handleChatRef}>
        <Chat
          navbar={{
            title: 'Mars模型评测助手',
            leftContent: {
              icon: 'chevron-left',
              onClick: handleCloseChat,
            },
            rightContent: [], // 设置为空数组，移除帮助和设置按钮
          }}
          messages={messages}
          renderMessageContent={renderMessageContent}
          quickReplies={quickReplies}
          onQuickReplyClick={handleQuickReplyClick}
          onSend={handleSend}
          locale="zh-CN"
          placeholder="输入您的问题..."
          wideBreakpoint="600px"
          isTyping={isTyping}
        />
      </ScrollFixer>
      
      {/* 图片预览层 */}
      {previewImage && (
        <div 
          className="image-preview-overlay" 
          onClick={handleClosePreview}
        >
          <button 
            className="image-preview-close"
            onClick={handleClosePreview}
          >
            <CloseOutlined />
          </button>
          <img 
            src={previewImage} 
            alt="预览图片" 
            className="image-preview-image"
            onClick={handleClosePreview}
          />
        </div>
      )}
    </div>
  );
});

export default CustomerAssistant; 