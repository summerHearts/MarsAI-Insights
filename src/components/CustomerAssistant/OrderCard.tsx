import React from 'react';
import './styles/order-card.css';

// 定义订单状态类型
export type OrderStatus = 'pending' | 'shipped' | 'completed' | 'canceled';

// 定义订单商品类型
export interface OrderProduct {
  id: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  specs?: string;
}

// 定义订单卡片属性
export interface OrderCardProps {
  orderId: string;
  status: OrderStatus;
  createTime: string;
  products: OrderProduct[];
  totalAmount: number;
  onViewDetail?: (orderId: string) => void;
  onTrack?: (orderId: string) => void;
}

// 获取订单状态显示文本
const getStatusText = (status: OrderStatus): string => {
  const statusMap = {
    pending: '待发货',
    shipped: '已发货',
    completed: '已完成',
    canceled: '已取消'
  };
  return statusMap[status] || '处理中';
};

const OrderCard: React.FC<OrderCardProps> = ({
  orderId,
  status,
  createTime,
  products,
  totalAmount,
  onViewDetail,
  onTrack
}) => {
  // 处理查看详情
  const handleViewDetail = () => {
    onViewDetail && onViewDetail(orderId);
  };

  // 处理物流跟踪
  const handleTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTrack && onTrack(orderId);
  };

  return (
    <div className="order-card">
      <div className="order-card-header">
        <h4 className="order-card-title">订单 #{orderId.slice(-8)}</h4>
        <div className={`order-card-status status-${status}`}>
          {getStatusText(status)}
        </div>
      </div>
      
      <div className="order-card-content">
        <div className="order-info">
          <div className="order-info-item">
            <span className="order-info-label">下单时间</span>
            <span className="order-info-value">{createTime}</span>
          </div>
        </div>
        
        <div className="order-products">
          {products.map((product) => (
            <div key={product.id} className="order-product">
              {product.image && (
                <img 
                  className="order-product-img" 
                  src={product.image} 
                  alt={product.name} 
                />
              )}
              <div className="order-product-info">
                <div className="order-product-name">{product.name}</div>
                <div className="order-product-meta">
                  <span>{product.specs || `x${product.quantity}`}</span>
                  <span className="order-product-price">¥{product.price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="order-footer">
        <div className="order-total">
          共{products.reduce((sum, product) => sum + product.quantity, 0)}件
          <span className="order-total-amount">¥{totalAmount.toFixed(2)}</span>
        </div>
        <div className="order-actions">
          {status === 'shipped' && (
            <button className="order-action-btn" onClick={handleTrack}>
              查看物流
            </button>
          )}
          <button 
            className="order-action-btn primary" 
            onClick={handleViewDetail}
          >
            订单详情
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderCard; 