import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber } from 'antd';
import { ConnectionConfig } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nProvider';

interface ConnectionModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: (values: ConnectionConfig) => Promise<void>;
  initialValues?: Partial<ConnectionConfig>;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({ open, onCancel, onSave, initialValues }) => {
  const { t } = useI18n();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.resetFields();
        form.setFieldsValue({
          dbType: 'mysql',
          host: 'localhost',
          port: 3306,
        });
      }
    }
  }, [open, initialValues, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSave({
        ...initialValues,
        ...values,
      } as ConnectionConfig);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleDbTypeChange = (value: string) => {
    // Automatically set default port based on dbType
    const ports: Record<string, number> = {
      mysql: 3306,
      postgres: 5432,
      mssql: 1433,
      clickhouse: 8123,
    };
    if (ports[value]) {
      form.setFieldValue('port', ports[value]);
    }
  };

  return (
    <Modal
      title={initialValues ? t('connectionModal.editTitle') : t('connectionModal.addTitle')}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        name="connectionForm"
      >
        <Form.Item
          name="name"
          label={t('connectionModal.name')}
          rules={[{ required: true, message: t('connectionModal.nameRequired') }]}
        >
          <Input placeholder={t('connectionModal.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          name="dbType"
          label={t('connectionModal.dbType')}
          rules={[{ required: true, message: t('connectionModal.dbTypeRequired') }]}
        >
          <Select onChange={handleDbTypeChange}>
            <Select.Option value="mysql">MySQL</Select.Option>
            <Select.Option value="postgres">PostgreSQL</Select.Option>
            <Select.Option value="mssql">SQL Server</Select.Option>
            <Select.Option value="clickhouse">ClickHouse</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Form.Item
            name="host"
            label={t('connectionModal.host')}
            rules={[{ required: true, message: t('connectionModal.hostRequired') }]}
            style={{ display: 'inline-block', width: 'calc(70% - 8px)' }}
          >
            <Input placeholder="localhost" />
          </Form.Item>
          <Form.Item
            name="port"
            label={t('connectionModal.port')}
            rules={[{ required: true, message: t('connectionModal.portRequired') }]}
            style={{ display: 'inline-block', width: 'calc(30%)', margin: '0 0 0 8px' }}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form.Item>

        <Form.Item
          name="username"
          label={t('connectionModal.username')}
          rules={[{ required: true, message: t('connectionModal.usernameRequired') }]}
        >
          <Input placeholder="root" />
        </Form.Item>

        <Form.Item
          name="password"
          label={t('connectionModal.password')}
        >
          <Input.Password placeholder={t('connectionModal.passwordPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="database"
          label={t('connectionModal.database')}
        >
          <Input placeholder={t('connectionModal.databasePlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ConnectionModal;
