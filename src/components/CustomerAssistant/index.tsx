import React, { useState, useEffect, useCallback, useRef, memo, forwardRef } from 'react';
import Chat, { Bubble, useMessages, Card, List, ListItem, SystemMessage } from '@chatui/core';
import '@chatui/core/dist/index.css';
import './style.css';
import { CustomerServiceOutlined, UserOutlined, RocketOutlined, StarOutlined, ClockCircleOutlined } from '@ant-design/icons';

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

// 快速回复选项
const quickReplies = [
  {
    icon: 'message',
    name: '常见问题',
    code: 'faq',
  },
  {
    icon: 'search',
    name: '功能搜索',
    code: 'search',
  },
  {
    icon: 'shop',
    name: '产品展示',
    code: 'products',
  },
  {
    icon: 'help',
    name: '联系人工客服',
    code: 'human',
  },
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
      style={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
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
      // 添加用户消息，确保设置position为right
      appendMsg({
        type: 'text',
        content: { 
          text: val,
          time: formatTime() 
        },
        position: 'right', // 明确指定位置为右侧
        user: { avatar: USER_AVATAR },
      });

      // 模拟回复中状态
      setIsTyping(true);
      
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
    // 模拟用户点击产品操作
    appendMsg({
      type: 'text',
      content: { 
        text: `我想${action.includes('use') ? '使用' : '了解'}${productCards.find(p => p.id === productId)?.title}`,
        time: formatTime() 
      },
      position: 'right',
      user: { avatar: USER_AVATAR },
    });

    // 模拟回复中状态
    setIsTyping(true);
    
    // 模拟延迟回复
    setTimeout(() => {
      let response = '';
      
      if (action.includes('use')) {
        response = `好的，请点击页面顶部导航栏的"${productCards.find(p => p.id === productId)?.title}"按钮，即可开始使用该功能。`;
      } else if (action.includes('learn')) {
        response = `${productCards.find(p => p.id === productId)?.title}是我们的核心功能之一，它可以${productCards.find(p => p.id === productId)?.description}。您可以通过页面顶部导航栏进入该功能页面体验。`;
      } else if (action.includes('demo')) {
        response = `好的，您可以在我们的官方文档中查看${productCards.find(p => p.id === productId)?.title}的演示视频和示例。`;
      }
      
      appendMsg({
        type: 'text',
        content: { 
          text: response,
          time: formatTime() 
        },
        position: 'left',
        user: { avatar: ASSISTANT_AVATAR },
      });
      setIsTyping(false);
    }, 1200);
  }, [appendMsg]);

  // 自定义渲染消息内容
  const renderMessageContent = useCallback((msg: any) => {
    const { type, content } = msg;
    
    // 处理文本消息
    if (type === 'text') {
      return (
        <div className="message-wrapper">
          <Bubble content={content.text} />
          {content.time && (
            <div className={`message-time ${msg.position === 'right' ? 'Message--right' : 'Message--left'}`}>
              <ClockCircleOutlined /> {content.time}
            </div>
          )}
        </div>
      );
    }
    
    // 处理系统消息
    if (type === 'system') {
      return <SystemMessage content={content.text} />;
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
          {content.time && (
            <div className="message-time Message--left">
              <ClockCircleOutlined /> {content.time}
            </div>
          )}
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
          {content.time && (
            <div className="message-time Message--left">
              <ClockCircleOutlined /> {content.time}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  }, [handleCardClick, handleProductAction]);
  
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
    </div>
  );
});

export default CustomerAssistant; 