import React, { useState } from 'react';
import './styles/image-message.css';

// 定义图片布局方式
export type ImageLayout = 'left' | 'right' | 'top' | 'bottom';

// 图片消息组件属性
export interface ImageMessageProps {
  src: string;
  alt?: string;
  caption?: string;
  width?: number | string;
  height?: number | string;
  onClick?: (src: string) => void;
}

// 图文混排组件属性
export interface ImageWithTextProps {
  src: string;
  alt?: string;
  text: string;
  layout?: ImageLayout;
  onClick?: (src: string) => void;
}

// 单独的图片消息组件
export const ImageMessage: React.FC<ImageMessageProps> = ({
  src,
  alt = '图片',
  caption,
  width,
  height,
  onClick
}) => {
  const handleClick = () => {
    onClick && onClick(src);
  };

  return (
    <div className="image-message">
      <div className="image-message-content">
        <img 
          src={src} 
          alt={alt} 
          className="image-message-img" 
          style={{ width, height }}
          onClick={handleClick}
        />
        {caption && (
          <div className="image-message-caption">{caption}</div>
        )}
      </div>
    </div>
  );
};

// 图文混排组件
export const ImageWithText: React.FC<ImageWithTextProps> = ({
  src,
  alt = '图片',
  text,
  layout = 'left',
  onClick
}) => {
  const [imageError, setImageError] = useState(false);

  // 处理图片点击
  const handleClick = () => {
    onClick && onClick(src);
  };

  // 处理图片加载错误
  const handleError = () => {
    console.error('图片加载失败:', src);
    setImageError(true);
  };

  // 如果图片加载失败，只显示文本内容
  if (imageError) {
    return <div className="image-with-text-content">{text}</div>;
  }

  return (
    <div className={`image-with-text image-with-text-${layout}`}>
      <img 
        src={src} 
        alt={alt} 
        className="image-with-text-img" 
        onClick={handleClick}
        onError={handleError}
      />
      <div className="image-with-text-content">{text}</div>
    </div>
  );
};

// 默认导出图文混排组件
export default ImageWithText; 