import React, { memo } from 'react';
import { CustomerServiceOutlined, CloseOutlined } from '@ant-design/icons';
import './style.css';

interface AssistantButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

const AssistantButton: React.FC<AssistantButtonProps> = memo(({ isOpen, onClick }) => {
  // 阻止事件冒泡
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };
  
  return (
    <button 
      className="assistant-button" 
      onClick={handleClick}
      aria-label={isOpen ? "关闭客服" : "打开客服"}
      type="button"
    >
      {isOpen ? <CloseOutlined /> : <CustomerServiceOutlined />}
    </button>
  );
});

export default AssistantButton; 