import React, { useState, useEffect } from 'react';
import { Button, Card, List, Modal, Space, Typography, Input, Popconfirm, Empty, Tabs } from 'antd';
import { DeleteOutlined, EditOutlined, ExportOutlined, ImportOutlined, HistoryOutlined, SaveOutlined } from '@ant-design/icons';
import { SavedComparison, SavedInput } from '../types';

const { Text, Paragraph } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

interface SavedComparisonsProps {
  savedComparisons: SavedComparison[];
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onLoad: (comparison: SavedComparison) => void;
  onExportAll: () => void;
  onImport: (file: File) => void;
  listTitle?: string;
  savedInputs?: SavedInput[];
  onLoadInput?: (input: SavedInput) => void;
  onDeleteInput?: (id: string) => void;
  onRenameInput?: (id: string, newTitle: string) => void;
}

const SavedComparisons: React.FC<SavedComparisonsProps> = ({
  savedComparisons,
  onDelete,
  onRename,
  onLoad,
  onExportAll,
  onImport,
  listTitle = '历史评测记录',
  savedInputs = [],
  onLoadInput,
  onDeleteInput,
  onRenameInput
}) => {
  const [searchText, setSearchText] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingComparison, setEditingComparison] = useState<SavedComparison | null>(null);
  const [editingInput, setEditingInput] = useState<SavedInput | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [activeTab, setActiveTab] = useState<string>('comparisons');

  const filteredComparisons = savedComparisons.filter(comparison => 
    comparison.title.toLowerCase().includes(searchText.toLowerCase()) ||
    comparison.prompt.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredInputs = savedInputs.filter(input => 
    input.title.toLowerCase().includes(searchText.toLowerCase()) ||
    input.prompt.toLowerCase().includes(searchText.toLowerCase())
  );

  const showEditModal = (item: SavedComparison | SavedInput) => {
    if ('responses' in item) {
      setEditingComparison(item);
      setEditingInput(null);
    } else {
      setEditingInput(item);
      setEditingComparison(null);
    }
    setNewTitle(item.title);
    setEditModalVisible(true);
  };

  const handleRename = () => {
    if (editingComparison && newTitle.trim() && onRename) {
      onRename(editingComparison.id, newTitle.trim());
      setEditModalVisible(false);
    } else if (editingInput && newTitle.trim() && onRenameInput) {
      onRenameInput(editingInput.id, newTitle.trim());
      setEditModalVisible(false);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e: any) => {
      if (e.target.files.length) {
        onImport(e.target.files[0]);
      }
    };
    
    input.click();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleExportInputs = () => {
    if (savedInputs.length === 0) {
      return;
    }
    
    const dataStr = JSON.stringify(savedInputs, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `saved-inputs-export-${new Date().getTime()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <Card 
      title={
        <Space>
          <HistoryOutlined />
          <span>{listTitle}</span>
        </Space>
      }
      extra={
        <Space>
          <Button 
            icon={<ExportOutlined />} 
            onClick={activeTab === 'comparisons' ? onExportAll : handleExportInputs}
            disabled={(activeTab === 'comparisons' && savedComparisons.length === 0) || 
                     (activeTab === 'inputs' && savedInputs.length === 0)}
          >
            导出全部
          </Button>
          <Button 
            icon={<ImportOutlined />} 
            onClick={handleImportClick}
          >
            导入
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="历史记录" key="comparisons">
          <Search
            placeholder="搜索历史记录..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ marginBottom: 16 }}
            allowClear
          />
          
          {filteredComparisons.length > 0 ? (
            <List
              itemLayout="vertical"
              dataSource={filteredComparisons}
              renderItem={comparison => (
                <List.Item
                  key={comparison.id}
                  actions={[
                    <Button 
                      key="load" 
                      type="link" 
                      onClick={() => onLoad(comparison)}
                    >
                      加载
                    </Button>,
                    <Button 
                      key="edit" 
                      type="link" 
                      icon={<EditOutlined />}
                      onClick={() => showEditModal(comparison)}
                    >
                      重命名
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="确定要删除这条记录吗？"
                      onConfirm={() => onDelete(comparison.id)}
                      okText="是"
                      cancelText="否"
                    >
                      <Button 
                        type="link" 
                        danger
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={comparison.title}
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary">
                          创建时间: {formatDate(comparison.timestamp)}
                        </Text>
                        <Text type="secondary">
                          模型数量: {comparison.responses.length}
                        </Text>
                      </Space>
                    }
                  />
                  <Paragraph ellipsis={{ rows: 2 }}>
                    <Text strong>提示词: </Text>
                    {comparison.prompt}
                  </Paragraph>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无记录" />
          )}
        </TabPane>
        
        {onLoadInput && onDeleteInput && onRenameInput && (
          <TabPane tab="保存的输入" key="inputs">
            <Search
              placeholder="搜索保存的输入..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ marginBottom: 16 }}
              allowClear
            />
            
            {filteredInputs.length > 0 ? (
              <List
                itemLayout="vertical"
                dataSource={filteredInputs}
                renderItem={input => (
                  <List.Item
                    key={input.id}
                    actions={[
                      <Button 
                        key="load" 
                        type="link" 
                        onClick={() => onLoadInput(input)}
                      >
                        加载
                      </Button>,
                      <Button 
                        key="edit" 
                        type="link" 
                        icon={<EditOutlined />}
                        onClick={() => showEditModal(input)}
                      >
                        重命名
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="确定要删除这个输入吗？"
                        onConfirm={() => onDeleteInput(input.id)}
                        okText="是"
                        cancelText="否"
                      >
                        <Button 
                          type="link" 
                          danger
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      title={input.title}
                      description={
                        <Text type="secondary">
                          创建时间: {formatDate(input.timestamp)}
                        </Text>
                      }
                    />
                    <Paragraph ellipsis={{ rows: 2 }}>
                      <Text strong>提示词: </Text>
                      {input.prompt}
                    </Paragraph>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无保存的输入" />
            )}
          </TabPane>
        )}
      </Tabs>
      
      <Modal
        title="重命名"
        open={editModalVisible}
        onOk={handleRename}
        onCancel={() => setEditModalVisible(false)}
      >
        <Input
          placeholder="输入新标题"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
        />
      </Modal>
    </Card>
  );
};

export default SavedComparisons; 