import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Form, Input, message, Tabs, Alert, Select, Button, Card, Popconfirm } from 'antd';
import { KeyOutlined, SafetyCertificateOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { AppLanguage, LlmProvider } from '../../../shared/types';
import { useI18n } from '../../i18n/i18n-context';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const ensureProviderId = (provider: Partial<LlmProvider>): LlmProvider => ({
  id: provider.id || crypto.randomUUID(),
  name: provider.name || '',
  provider: provider.provider || 'openai',
  baseUrl: provider.baseUrl?.trim() || undefined,
  model: provider.model || '',
  apiKey: provider.apiKey,
});

const normalizeProviders = (providers: Array<Partial<LlmProvider>> = []): LlmProvider[] =>
  providers.map(ensureProviderId);

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { setLanguage, t } = useI18n();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<LlmProvider[]>([]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const appLanguage = await window.api.settings.getAppLanguage();
      const loadedProviders = normalizeProviders(await window.api.settings.getLlmProviders());
      const activeId = await window.api.settings.getActiveLlmProvider();
      const resolvedActiveId = loadedProviders.some((provider) => provider.id === activeId)
        ? activeId
        : loadedProviders[0]?.id;
      
      setProviders(loadedProviders);
      form.setFieldsValue({
        language: appLanguage,
        activeProviderId: resolvedActiveId,
        providers: loadedProviders,
      });
    } catch (error) {
      console.error('Failed to load settings', error);
      message.error(t('settings.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [form, t]);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [loadSettings, open]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const selectedLanguage = values.language as AppLanguage;

      const normalizedProviders = normalizeProviders(values.providers || []);
      const activeProviderId = normalizedProviders.some((provider) => provider.id === values.activeProviderId)
        ? values.activeProviderId
        : normalizedProviders[0]?.id;

      await window.api.settings.setAppLanguage(selectedLanguage);
      await window.api.settings.saveLlmProviders(normalizedProviders);
      if (activeProviderId) {
        await window.api.settings.setActiveLlmProvider(activeProviderId);
      }
      await setLanguage(selectedLanguage, false);

      setProviders(normalizedProviders);
      form.setFieldsValue({
        language: selectedLanguage,
        activeProviderId,
        providers: normalizedProviders,
      });
      message.success(t('settings.saveSuccess'));
      onClose();
    } catch (error) {
      console.error('Failed to save settings', error);
      message.error(error instanceof Error ? error.message : t('settings.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const generalSettings = (
    <div className="py-4 h-[500px] overflow-y-auto">
      <Form form={form} layout="vertical">
        <Form.Item label={t('settings.language.label')} name="language">
          <Select placeholder={t('settings.language.placeholder')}>
            <Select.Option value="zh-CN">{t('settings.language.zh-CN')}</Select.Option>
            <Select.Option value="en-US">{t('settings.language.en-US')}</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </div>
  );

  const llmSettings = (
    <div className="py-4 h-[500px] overflow-y-auto">
      <Alert
        message={t('settings.llmSecurityTitle')}
        description={t('settings.llmSecurityDescription')}
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        className="mb-6"
      />
      <Form form={form} layout="vertical">
        <Form.Item label={t('settings.activeProvider')} name="activeProviderId">
          <Select placeholder={t('settings.selectProvider')}>
            {providers.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div className="mb-2 flex justify-between items-center">
          <h3 className="text-lg font-medium">{t('settings.providerList')}</h3>
        </div>

        <Form.List name="providers">
          {(fields, { add, remove }) => (
            <div className="space-y-4">
              {fields.map((field) => (
                <Card 
                  key={field.key} 
                  size="small" 
                  className="bg-[#050505] border-[#333333]"
                  extra={
                    <Popconfirm
                      title={t('settings.deleteProviderConfirm')}
                      onConfirm={() => {
                        remove(field.name);
                        const currentProviders = normalizeProviders(form.getFieldValue('providers') || []);
                        setProviders(currentProviders);
                      }}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  }
                >
                  <Form.Item
                    label={t('settings.providerId')}
                    name={[field.name, 'id']}
                    hidden
                  >
                    <Input />
                  </Form.Item>
                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      label={t('settings.providerName')}
                      name={[field.name, 'name']}
                      rules={[{ required: true, message: t('settings.providerNameRequired') }]}
                    >
                      <Input placeholder={t('settings.providerNamePlaceholder')} onChange={() => setProviders(form.getFieldValue('providers'))} />
                    </Form.Item>

                    <Form.Item
                      label={t('settings.providerType')}
                      name={[field.name, 'provider']}
                      rules={[{ required: true, message: t('settings.providerTypeRequired') }]}
                    >
                      <Select>
                        <Select.Option value="openai">{t('settings.providerType.openai')}</Select.Option>
                        <Select.Option value="anthropic">{t('settings.providerType.anthropic')}</Select.Option>
                      </Select>
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      label={t('settings.baseUrl')}
                      name={[field.name, 'baseUrl']}
                      tooltip={t('settings.baseUrlTooltip')}
                    >
                      <Input placeholder="https://api.openai.com/v1" />
                    </Form.Item>

                    <Form.Item
                      label={t('settings.modelName')}
                      name={[field.name, 'model']}
                      rules={[{ required: true, message: t('settings.modelNameRequired') }]}
                    >
                      <Input placeholder={t('settings.modelNamePlaceholder')} />
                    </Form.Item>
                  </div>

                  <Form.Item
                    label={t('settings.apiKey')}
                    name={[field.name, 'apiKey']}
                    tooltip={t('settings.apiKeyTooltip')}
                  >
                    <Input.Password 
                      prefix={<KeyOutlined className="text-gray-400" />} 
                      placeholder="sk-..." 
                      allowClear
                    />
                  </Form.Item>
                </Card>
              ))}

              <Button 
                type="dashed" 
                onClick={() => {
                  const nextProvider = ensureProviderId({
                    name: t('settings.newProviderName'),
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                  });
                  add(nextProvider);
                  const currentProviders = normalizeProviders([...(form.getFieldValue('providers') || []), nextProvider]);
                  setProviders(currentProviders);
                  if (!form.getFieldValue('activeProviderId')) {
                    form.setFieldValue('activeProviderId', nextProvider.id);
                  }
                }} 
                block 
                icon={<PlusOutlined />}
              >
                {t('settings.addProvider')}
              </Button>
            </div>
          )}
        </Form.List>
      </Form>
    </div>
  );

  const items = [
    {
      key: 'general',
      label: t('settings.tab.general'),
      children: generalSettings,
    },
    {
      key: 'llm',
      label: t('settings.tab.llm'),
      children: llmSettings,
    },
  ];

  return (
    <Modal
      title={t('settings.title')}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={loading}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      width={700}
      destroyOnClose
    >
      <Tabs items={items} />
    </Modal>
  );
};

export default SettingsModal;
