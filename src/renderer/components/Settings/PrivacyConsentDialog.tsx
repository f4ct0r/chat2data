import React, { useEffect, useState } from 'react';
import { Modal, Typography, Button } from 'antd';
import { SafetyCertificateOutlined, CloudUploadOutlined, LockOutlined } from '@ant-design/icons';
import { useI18n } from '../../i18n/i18n-context';

const { Title, Paragraph, Text } = Typography;

const PrivacyConsentDialog: React.FC = () => {
  const { t } = useI18n();
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
        <Title level={3}>{t('privacy.title')}</Title>
      </div>

      <div className="space-y-6">
        <Paragraph>
          {t('privacy.intro')}
        </Paragraph>

        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="flex gap-3">
            <CloudUploadOutlined className="text-xl text-blue-500 mt-1" />
            <div>
              <Text strong className="block mb-1">{t('privacy.cloudDataTitle')}</Text>
              <Text type="secondary">
                {t('privacy.cloudDataDescription')}
              </Text>
            </div>
          </div>

          <div className="flex gap-3">
            <LockOutlined className="text-xl text-green-500 mt-1" />
            <div>
              <Text strong className="block mb-1">{t('privacy.localOnlyTitle')}</Text>
              <Text type="secondary">
                {t('privacy.localOnlyDescription')}
              </Text>
            </div>
          </div>
        </div>

        <Paragraph className="text-sm text-gray-500">
          {t('privacy.footer')}
        </Paragraph>
      </div>

      <div className="flex justify-end gap-3 mt-8">
        <Button onClick={handleDecline}>{t('privacy.decline')}</Button>
        <Button type="primary" loading={loading} onClick={handleConsent}>
          {t('privacy.accept')}
        </Button>
      </div>
    </Modal>
  );
};

export default PrivacyConsentDialog;
