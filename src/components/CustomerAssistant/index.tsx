import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import Chat, { Bubble, useMessages, Card, List, ListItem, SystemMessage } from '@chatui/core';
import '@chatui/core/dist/index.css';
import './style.css';
import { CustomerServiceOutlined, UserOutlined } from '@ant-design/icons';

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
    icon: 'help',
    name: '联系人工客服',
    code: 'human',
  },
];

// 模拟API请求延迟
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const CustomerAssistant: React.FC<CustomerAssistantProps> = memo(({ isOpen, onClose }) => {
  // 使用ChatUI的useMessages钩子管理消息
  const { messages, appendMsg } = useMessages([]);
  const [isTyping, setIsTyping] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 防止滚动事件传播到主应用
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      if (chatContainerRef.current?.contains(e.target as Node)) {
        e.stopPropagation();
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  // 初始化欢迎消息
  useEffect(() => {
    if (isOpen && !initialized) {
      // 添加系统消息作为欢迎
      appendMsg({
        type: 'system',
        content: { text: '欢迎使用Mars模型评测平台智能助手' },
      });
      
      // 添加助手欢迎消息
      appendMsg({
        type: 'text',
        content: { text: '您好，我是Mars模型评测平台的智能助手！您可以向我咨询关于平台使用的任何问题，或者点击下方的快速回复选项。' },
        user: { avatar: ASSISTANT_AVATAR },
      });
      
      // 展示常见问题卡片
      appendMsg({
        type: 'card',
        content: {
          code: 'faq-intro',
          title: '您可能想了解的问题',
          items: commonQuestions.slice(0, 3).map(q => ({
            id: q.id,
            title: q.title,
          })),
        },
        user: { avatar: ASSISTANT_AVATAR },
      });
      
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
        content: { text: val },
        position: 'right', // 明确指定位置为右侧
        user: { avatar: USER_AVATAR },
      });

      // 模拟回复中状态
      setIsTyping(true);
      
      // 模拟延迟回复
      setTimeout(() => {
        appendMsg({
          type: 'text',
          content: { text: getResponse(val) },
          position: 'left', // 明确指定位置为左侧
          user: { avatar: ASSISTANT_AVATAR },
        });
        setIsTyping(false);
      }, 1000);
    }
  }, [appendMsg]);

  // 处理快速回复点击
  const handleQuickReplyClick = useCallback((reply: any) => {
    handleSend('text', reply.name);
  }, [handleSend]);

  // 处理卡片点击
  const handleCardClick = useCallback((item: any) => {
    // 模拟用户点击问题
    appendMsg({
      type: 'text',
      content: { text: item.title },
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
        content: { text: response },
        position: 'left', // 明确指定位置为左侧
        user: { avatar: ASSISTANT_AVATAR },
      });
      setIsTyping(false);
    }, 1000);
  }, [appendMsg]);

  // 自定义渲染消息内容
  const renderMessageContent = useCallback((msg: any) => {
    const { type, content } = msg;
    
    // 处理文本消息，不再额外处理position
    if (type === 'text') {
      return <Bubble content={content.text} />;
    }
    
    // 处理系统消息
    if (type === 'system') {
      return <SystemMessage content={content.text} />;
    }
    
    // 处理卡片消息
    if (type === 'card') {
      const { title, items } = content;
      return (
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
      );
    }
    
    return null;
  }, [handleCardClick]);
  
  // 阻止事件冒泡
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="customer-assistant-container" 
      ref={chatContainerRef}
      onClick={handleContainerClick}
    >
      <Chat
        wideBreakpoint="600px"
        navbar={{
          title: '客服小助手',
          leftContent: {
            icon: 'chevron-right',
            onClick: onClose,
          },
        }}
        messages={messages}
        renderMessageContent={renderMessageContent}
        quickReplies={quickReplies}
        onQuickReplyClick={handleQuickReplyClick}
        onSend={handleSend}
        placeholder="请输入您的问题..."
        locale="zh-CN"
        loadMoreText="加载更多"
        toolbar={[
          {
            type: 'image',
            icon: 'image',
            title: '发送图片',
          }
        ]}
        isTyping={isTyping}
      />
    </div>
  );
});

export default CustomerAssistant; 