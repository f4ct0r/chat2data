import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Form, Input, message, Tabs, Alert, Select, Button, Card, Popconfirm } from 'antd';
import { KeyOutlined, SafetyCertificateOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { LlmProvider } from '../../../shared/types';

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
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<LlmProvider[]>([]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const loadedProviders = normalizeProviders(await window.api.settings.getLlmProviders());
      const activeId = await window.api.settings.getActiveLlmProvider();
      const resolvedActiveId = loadedProviders.some((provider) => provider.id === activeId)
        ? activeId
        : loadedProviders[0]?.id;
      
      setProviders(loadedProviders);
      form.setFieldsValue({
        activeProviderId: resolvedActiveId,
        providers: loadedProviders,
      });
    } catch (error) {
      console.error('Failed to load settings', error);
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [loadSettings, open]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const normalizedProviders = normalizeProviders(values.providers || []);
      const activeProviderId = normalizedProviders.some((provider) => provider.id === values.activeProviderId)
        ? values.activeProviderId
        : normalizedProviders[0]?.id;

      await window.api.settings.saveLlmProviders(normalizedProviders);
      if (activeProviderId) {
        await window.api.settings.setActiveLlmProvider(activeProviderId);
      }

      setProviders(normalizedProviders);
      form.setFieldsValue({
        activeProviderId,
        providers: normalizedProviders,
      });
      message.success('设置保存成功');
      onClose();
    } catch (error) {
      console.error('Failed to save settings', error);
      message.error(error instanceof Error ? error.message : '保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  const llmSettings = (
    <div className="py-4 h-[500px] overflow-y-auto">
      <Alert
        message="API Key 安全说明"
        description="您的 API Key 使用系统级安全存储 (safeStorage) 加密保存在本地，绝不会上传到任何第三方服务器。留空表示不修改已有 Key。"
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        className="mb-6"
      />
      <Form form={form} layout="vertical">
        <Form.Item label="当前默认使用的模型提供商" name="activeProviderId">
          <Select placeholder="请选择提供商">
            {providers.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div className="mb-2 flex justify-between items-center">
          <h3 className="text-lg font-medium">提供商列表</h3>
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
                      title="确定要删除这个提供商吗？"
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
                    {...field}
                    label="提供商 ID"
                    name={[field.name, 'id']}
                    hidden
                  >
                    <Input />
                  </Form.Item>
                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      {...field}
                      label="名称"
                      name={[field.name, 'name']}
                      rules={[{ required: true, message: '请输入名称' }]}
                    >
                      <Input placeholder="例如：我的 OpenAI" onChange={() => setProviders(form.getFieldValue('providers'))} />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      label="类型"
                      name={[field.name, 'provider']}
                      rules={[{ required: true, message: '请选择类型' }]}
                    >
                      <Select>
                        <Select.Option value="openai">OpenAI 兼容</Select.Option>
                        <Select.Option value="anthropic">Anthropic</Select.Option>
                      </Select>
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      {...field}
                      label="Base URL (可选)"
                      name={[field.name, 'baseUrl']}
                      tooltip="如果为空，将使用默认的官方 API 地址"
                    >
                      <Input placeholder="https://api.openai.com/v1" />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      label="模型名称"
                      name={[field.name, 'model']}
                      rules={[{ required: true, message: '请输入模型名称' }]}
                    >
                      <Input placeholder="例如：gpt-4o-mini 或 claude-3-haiku" />
                    </Form.Item>
                  </div>

                  <Form.Item
                    {...field}
                    label="API Key"
                    name={[field.name, 'apiKey']}
                    tooltip="保存在本地安全存储中。若已有值会显示 ********，再次输入将覆盖。"
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
                    name: 'New Provider',
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
                添加模型提供商
              </Button>
            </div>
          )}
        </Form.List>
      </Form>
    </div>
  );

  const items = [
    {
      key: 'llm',
      label: 'LLM 设置',
      children: llmSettings,
    },
  ];

  return (
    <Modal
      title="系统设置"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      width={700}
      destroyOnClose
    >
      <Tabs items={items} />
    </Modal>
  );
};

export default SettingsModal;
