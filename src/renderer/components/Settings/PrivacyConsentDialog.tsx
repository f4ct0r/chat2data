import React, { useEffect, useState } from 'react';
import { Modal, Typography, Button } from 'antd';
import { SafetyCertificateOutlined, CloudUploadOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const PrivacyConsentDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkConsent();
  }, []);

  const checkConsent = async () => {
    try {
      const hasConsented = await window.api.settings.getPrivacyConsent();
      if (!hasConsented) {
        setOpen(true);
      }
    } catch (error) {
      console.error('Failed to check privacy consent', error);
    }
  };

  const handleConsent = async () => {
    setLoading(true);
    try {
      await window.api.settings.savePrivacyConsent(true);
      setOpen(false);
    } catch (error) {
      console.error('Failed to save consent', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    // Usually we might just close or restrict features, but for now we'll just close
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      width={600}
      centered
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
          <SafetyCertificateOutlined />
        </div>
        <Title level={3}>隐私与数据安全说明</Title>
      </div>

      <div className="space-y-6">
        <Paragraph>
          欢迎使用 Chat2Data！在您使用我们的 AI 辅助查询功能（Agent 对话）之前，请了解我们是如何处理您的数据的。
        </Paragraph>

        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="flex gap-3">
            <CloudUploadOutlined className="text-xl text-blue-500 mt-1" />
            <div>
              <Text strong className="block mb-1">会发送至云端的数据 (LLM)</Text>
              <Text type="secondary">
                为了生成准确的 SQL，我们仅会发送您的提问以及相关的<Text strong>表结构（表名、字段名、类型、注释）</Text>。
              </Text>
            </div>
          </div>

          <div className="flex gap-3">
            <LockOutlined className="text-xl text-green-500 mt-1" />
            <div>
              <Text strong className="block mb-1">绝不发送的数据</Text>
              <Text type="secondary">
                我们<Text type="danger" strong>绝对不会</Text>将您的数据库连接密码、实际业务数据记录（如行内容）发送给任何第三方或云端。密码通过系统原生加密 (safeStorage) 仅保存在您的本地设备上。
              </Text>
            </div>
          </div>
        </div>

        <Paragraph className="text-sm text-gray-500">
          点击“同意并继续”即表示您已知晓并同意上述数据处理方式。您可以随时在设置中配置您的 LLM API Key。
        </Paragraph>
      </div>

      <div className="flex justify-end gap-3 mt-8">
        <Button onClick={handleDecline}>拒绝</Button>
        <Button type="primary" loading={loading} onClick={handleConsent}>
          同意并继续
        </Button>
      </div>
    </Modal>
  );
};

export default PrivacyConsentDialog;
