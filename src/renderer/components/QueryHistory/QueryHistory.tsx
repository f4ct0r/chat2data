import React from 'react';
import { Button, List, Tag } from 'antd';
import { PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { QueryHistoryItem } from '../SqlWorkspace/SqlWorkspace';
import { useI18n } from '../../i18n/i18n-context';

interface QueryHistoryProps {
  history: QueryHistoryItem[];
  onReplay: (sql: string) => void;
}

export const QueryHistory: React.FC<QueryHistoryProps> = ({ history, onReplay }) => {
  const { t } = useI18n();

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#737373] bg-[#050505] font-mono text-xs">
        {t('queryHistory.empty')}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto bg-[#050505] border border-[#333333] rounded-sm font-mono">
      <List
        className="query-history-list"
        itemLayout="horizontal"
        dataSource={history}
        renderItem={(item) => (
          <List.Item
            className="hover:bg-[#121212] px-4 py-2 border-b border-[#333333] last:border-b-0"
            actions={[
              <div key="replay" className="query-history-replay-action">
                <Button
                  type="text"
                  icon={<PlayCircleOutlined className="text-[#a3a3a3] hover:text-[#FF5722]" />}
                  onClick={() => onReplay(item.sql)}
                  title={t('queryHistory.loadIntoEditor')}
                  className="query-history-replay-button font-mono text-[#a3a3a3] hover:!text-[#FF5722]"
                >
                  {t('queryHistory.replay')}
                </Button>
              </div>
            ]}
          >
            <List.Item.Meta
              className="flex-1 min-w-0"
              title={
                <div className="query-history-meta-head flex items-center gap-2 mb-1">
                  {item.status === 'success' ? (
                    <CheckCircleOutlined className="text-[#00ff00]" />
                  ) : (
                    <CloseCircleOutlined className="text-[#ff0000]" />
                  )}
                  <span className="text-xs text-[#737373]">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  <Tag
                    color={item.status === 'success' ? 'green' : 'red'}
                    className="font-mono bg-transparent border-[#333333]"
                  >
                    {item.durationMs} MS
                  </Tag>
                </div>
              }
              description={
                <div className="flex flex-col gap-1">
                  <div className="font-mono text-sm text-[#00ff00] bg-[#000000] border border-[#333333] p-2 rounded-sm max-w-2xl overflow-x-auto whitespace-nowrap">
                    {item.sql}
                  </div>
                  {item.error && (
                    <div className="text-xs text-[#ff0000] truncate max-w-2xl" title={item.error}>
                      {t('queryHistory.errorPrefix')} {item.error}
                    </div>
                  )}
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default QueryHistory;
