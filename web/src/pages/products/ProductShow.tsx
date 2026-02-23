import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Descriptions,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  Table,
  Image,
  Divider,
  Statistic,
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  InboxOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";

const { Title, Text, Paragraph } = Typography;

const mockProduct = {
  id: "1",
  name: "Wireless Headphones Pro",
  sku: "WHP-001",
  description: "Premium noise-cancelling wireless headphones with 40-hour battery life, active noise cancellation, and premium sound quality. Features Bluetooth 5.3, USB-C charging, and a comfortable over-ear design with memory foam cushions.",
  price: 149.99,
  currency: "USD",
  category: "electronics",
  status: "active" as const,
  stock: 342,
  images: [
    "https://via.placeholder.com/400x400/0f6fa8/ffffff?text=Product+1",
    "https://via.placeholder.com/400x400/0ea5a4/ffffff?text=Product+2",
    "https://via.placeholder.com/400x400/15803d/ffffff?text=Product+3",
  ],
  createdAt: "2024-01-15T10:00:00Z",
};

const stockHistory = [
  { id: "1", date: "2024-03-20", type: "restock", quantity: 100, balance: 342 },
  { id: "2", date: "2024-03-18", type: "sale", quantity: -15, balance: 242 },
  { id: "3", date: "2024-03-15", type: "sale", quantity: -23, balance: 257 },
  { id: "4", date: "2024-03-10", type: "restock", quantity: 200, balance: 280 },
  { id: "5", date: "2024-03-05", type: "sale", quantity: -42, balance: 80 },
  { id: "6", date: "2024-02-28", type: "adjustment", quantity: -8, balance: 122 },
];

const ProductShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = { ...mockProduct, id: id || "1" };

  const stockColumns = [
    { title: "Date", dataIndex: "date", key: "date", render: (d: string) => formatDate(d) },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: string) => {
        const colors: Record<string, string> = { restock: "green", sale: "blue", adjustment: "orange" };
        return (
          <Tag color={colors[type] || "default"} style={{ textTransform: "capitalize", borderRadius: 6 }}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (qty: number) => (
        <Text style={{ color: qty > 0 ? "#15803d" : "#dc2626", fontWeight: 500 }}>
          {qty > 0 ? `+${qty}` : qty}
        </Text>
      ),
    },
    { title: "Balance", dataIndex: "balance", key: "balance" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/products")}
          style={{ marginBottom: 8, padding: 0 }}
        >
          Back to Products
        </Button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {product.name}
            </Title>
            <Text type="secondary">SKU: {product.sku}</Text>
          </div>
          <Space>
            <Button icon={<EditOutlined />}>Edit Product</Button>
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 10, textAlign: "center" }}>
            <Image.PreviewGroup>
              <Space direction="vertical" size={12}>
                <Image
                  width="100%"
                  style={{ borderRadius: 8, maxHeight: 300, objectFit: "cover" }}
                  src={product.images[0]}
                  fallback="https://via.placeholder.com/400x400/f0f0f0/999999?text=No+Image"
                />
                <Space>
                  {product.images.slice(1).map((img, i) => (
                    <Image
                      key={i}
                      width={80}
                      height={80}
                      style={{ borderRadius: 6, objectFit: "cover" }}
                      src={img}
                      fallback="https://via.placeholder.com/80x80/f0f0f0/999999?text=N/A"
                    />
                  ))}
                </Space>
              </Space>
            </Image.PreviewGroup>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card style={{ borderRadius: 10 }}>
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
              <Col xs={8}>
                <Statistic
                  title="Price"
                  value={product.price}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: "#0f6fa8", fontWeight: 700 }}
                />
              </Col>
              <Col xs={8}>
                <Statistic
                  title="In Stock"
                  value={product.stock}
                  prefix={<InboxOutlined />}
                  valueStyle={{
                    color: product.stock > 100 ? "#15803d" : product.stock > 0 ? "#d97706" : "#dc2626",
                    fontWeight: 700,
                  }}
                />
              </Col>
              <Col xs={8}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>Status</Text>
                  <div style={{ marginTop: 8 }}>
                    <StatusBadge status={product.status} />
                  </div>
                </div>
              </Col>
            </Row>

            <Divider />

            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Category">
                <Tag color="blue" style={{ textTransform: "capitalize" }}>
                  {product.category}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Currency">{product.currency}</Descriptions.Item>
              <Descriptions.Item label="Created">{formatDate(product.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="SKU">
                <Text copyable>{product.sku}</Text>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Title level={5}>Description</Title>
            <Paragraph style={{ fontSize: 14, color: "#595959" }}>
              {product.description}
            </Paragraph>
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Stock History</Title>}
        style={{ borderRadius: 10 }}
      >
        <Table
          dataSource={stockHistory}
          columns={stockColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default ProductShow;
