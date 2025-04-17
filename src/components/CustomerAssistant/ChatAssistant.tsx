import React, { useState, useEffect, memo } from 'react';
import CustomerAssistant from './index';
import AssistantButton from './AssistantButton';

const ChatAssistant: React.FC = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const toggleAssistant = () => {
    setIsOpen(prev => !prev);
    
    // 在移动设备上打开聊天时，防止背景滚动
    if (isMobile && !isOpen) {
      document.body.style.overflow = 'hidden';
    } else if (isMobile) {
      document.body.style.overflow = '';
    }
  };
  
  const handleClose = () => {
    setIsOpen(false);
    if (isMobile) {
      document.body.style.overflow = '';
    }
  };

  return (
    <div className="assistant-wrapper">
      <AssistantButton isOpen={isOpen} onClick={toggleAssistant} />
      <CustomerAssistant isOpen={isOpen} onClose={handleClose} />
    </div>
  );
});

export default ChatAssistant; 