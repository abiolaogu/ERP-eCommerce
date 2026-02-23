import React from "react";
import { useNavigate } from "react-router-dom";
import { useCreate } from "@refinedev/core";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Row,
  Col,
  Typography,
  Divider,
  Upload,
  Space,
} from "antd";
import { ArrowLeftOutlined, PlusOutlined, InboxOutlined } from "@ant-design/icons";
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES, CURRENCIES } from "@/utils/constants";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

const ProductCreate: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { mutate: create, isLoading } = useCreate();

  const handleSubmit = (values: Record<string, unknown>) => {
    create(
      {
        resource: "products",
        values: {
          ...values,
          images: [],
          createdAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => navigate("/products"),
        onError: () => navigate("/products"),
      }
    );
  };

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/products")}
        style={{ marginBottom: 16, padding: 0 }}
      >
        Back to Products
      </Button>

      <Title level={3}>Add New Product</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: "block" }}>
        Create a new product in your catalog.
      </Text>

      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark="optional">
        <Row gutter={24}>
          <Col xs={24} md={16}>
            <Card title="Product Details" style={{ borderRadius: 10, marginBottom: 16 }}>
              <Form.Item
                name="name"
                label="Product Name"
                rules={[{ required: true, message: "Please enter a product name" }]}
              >
                <Input placeholder="e.g., Wireless Headphones Pro" size="large" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="sku"
                    label="SKU"
                    rules={[{ required: true, message: "Please enter a SKU" }]}
                  >
                    <Input placeholder="e.g., WHP-001" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="category"
                    label="Category"
                    rules={[{ required: true, message: "Please select a category" }]}
                  >
                    <Select
                      placeholder="Select category"
                      size="large"
                      options={PRODUCT_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="description"
                label="Description"
                rules={[{ required: true, message: "Please enter a description" }]}
              >
                <TextArea rows={4} placeholder="Describe the product in detail..." />
              </Form.Item>

              <Divider orientation="left">Images</Divider>

              <Dragger
                name="images"
                multiple
                listType="picture-card"
                beforeUpload={() => false}
                style={{ borderRadius: 8 }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ color: "#0f6fa8", fontSize: 40 }} />
                </p>
                <p className="ant-upload-text">Click or drag files to upload</p>
                <p className="ant-upload-hint">Support for single or bulk upload of product images.</p>
              </Dragger>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card title="Pricing & Stock" style={{ borderRadius: 10, marginBottom: 16 }}>
              <Form.Item
                name="price"
                label="Price"
                rules={[{ required: true, message: "Please enter a price" }]}
              >
                <InputNumber
                  placeholder="0.00"
                  size="large"
                  style={{ width: "100%" }}
                  min={0}
                  precision={2}
                  prefix="$"
                />
              </Form.Item>

              <Form.Item name="currency" label="Currency" initialValue="USD">
                <Select
                  size="large"
                  options={CURRENCIES.map((c) => ({ label: c.label, value: c.value }))}
                />
              </Form.Item>

              <Form.Item
                name="stock"
                label="Stock Quantity"
                rules={[{ required: true, message: "Please enter stock quantity" }]}
              >
                <InputNumber placeholder="0" size="large" style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Card>

            <Card title="Status" style={{ borderRadius: 10, marginBottom: 16 }}>
              <Form.Item name="status" label="Product Status" initialValue="draft">
                <Select
                  size="large"
                  options={PRODUCT_STATUSES.map((s) => ({ label: s.label, value: s.value }))}
                />
              </Form.Item>
            </Card>

            <Space style={{ width: "100%" }} direction="vertical">
              <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                Create Product
              </Button>
              <Button block size="large" onClick={() => navigate("/products")}>
                Cancel
              </Button>
            </Space>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default ProductCreate;
