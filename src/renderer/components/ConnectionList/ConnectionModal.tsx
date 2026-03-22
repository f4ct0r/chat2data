import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber } from 'antd';
import { ConnectionConfig } from '../../../shared/types';

interface ConnectionModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: (values: ConnectionConfig) => Promise<void>;
  initialValues?: Partial<ConnectionConfig>;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({ open, onCancel, onSave, initialValues }) => {
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
      title={initialValues ? "Edit Connection" : "Add Connection"}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        name="connectionForm"
      >
        <Form.Item
          name="name"
          label="Connection Name"
          rules={[{ required: true, message: 'Please input the connection name!' }]}
        >
          <Input placeholder="e.g. Production DB" />
        </Form.Item>

        <Form.Item
          name="dbType"
          label="Database Type"
          rules={[{ required: true, message: 'Please select a database type!' }]}
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
            label="Host"
            rules={[{ required: true, message: 'Please input host!' }]}
            style={{ display: 'inline-block', width: 'calc(70% - 8px)' }}
          >
            <Input placeholder="localhost" />
          </Form.Item>
          <Form.Item
            name="port"
            label="Port"
            rules={[{ required: true, message: 'Please input port!' }]}
            style={{ display: 'inline-block', width: 'calc(30%)', margin: '0 0 0 8px' }}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form.Item>

        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: 'Please input username!' }]}
        >
          <Input placeholder="root" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
        >
          <Input.Password placeholder="Leave blank if unchanged (for edits)" />
        </Form.Item>

        <Form.Item
          name="database"
          label="Database (Optional)"
        >
          <Input placeholder="e.g. mydb" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ConnectionModal;
