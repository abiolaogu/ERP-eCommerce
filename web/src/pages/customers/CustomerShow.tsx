import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Descriptions,
  Table,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Avatar,
  Tag,
  Statistic,
  Divider,
  Timeline,
} from "antd";
import {
  ArrowLeftOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CarOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/utils/formatters";

const { Title, Text } = Typography;

const segmentColors: Record<string, string> = {
  vip: "gold",
  regular: "blue",
  new: "green",
  "at-risk": "orange",
  churned: "red",
};

const mockCustomer = {
  id: "1",
  name: "Sarah Johnson",
  email: "sarah.johnson@email.com",
  phone: "+1 (555) 123-4567",
  totalOrders: 28,
  totalSpent: 4523.50,
  segment: "vip",
  createdAt: "2023-06-15T10:00:00Z",
  address: "123 Main Street, Apt 4B, New York, NY 10001",
  avgOrderValue: 161.55,
};

const customerOrders = [
  { id: "o1", orderNumber: "ORD-2024-0891", total: 299.98, currency: "USD", status: "shipped", createdAt: new Date(Date.now() - 120000).toISOString(), items: 2 },
  { id: "o2", orderNumber: "ORD-2024-0850", total: 149.99, currency: "USD", status: "delivered", createdAt: new Date(Date.now() - 604800000).toISOString(), items: 1 },
  { id: "o3", orderNumber: "ORD-2024-0812", total: 445.00, currency: "USD", status: "delivered", createdAt: new Date(Date.now() - 1209600000).toISOString(), items: 3 },
  { id: "o4", orderNumber: "ORD-2024-0780", total: 89.99, currency: "USD", status: "delivered", createdAt: new Date(Date.now() - 2419200000).toISOString(), items: 1 },
  { id: "o5", orderNumber: "ORD-2024-0745", total: 312.00, currency: "USD", status: "delivered", createdAt: new Date(Date.now() - 3628800000).toISOString(), items: 4 },
];

const activity = [
  { time: new Date(Date.now() - 120000).toISOString(), action: "Placed order #ORD-2024-0891", type: "order" },
  { time: new Date(Date.now() - 86400000).toISOString(), action: "Added 3 items to cart", type: "browse" },
  { time: new Date(Date.now() - 172800000).toISOString(), action: "Updated shipping address", type: "account" },
  { time: new Date(Date.now() - 604800000).toISOString(), action: "Placed order #ORD-2024-0850", type: "order" },
  { time: new Date(Date.now() - 864000000).toISOString(), action: "Left a product review", type: "review" },
];

const CustomerShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customer = { ...mockCustomer, id: id || "1" };

  const orderColumns = [
    {
      title: "Order",
      dataIndex: "orderNumber",
      key: "orderNumber",
      render: (text: string, record: { id: string }) => (
        <a onClick={() => navigate(`/orders/${record.id}`)} style={{ fontWeight: 500 }}>
          #{text}
        </a>
      ),
    },
    {
      title: "Items",
      dataIndex: "items",
      key: "items",
      render: (count: number) => `${count} item${count !== 1 ? "s" : ""}`,
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (total: number, record: { currency: string }) => (
        <Text strong>{formatCurrency(total, record.currency)}</Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => <Text style={{ fontSize: 13 }}>{formatDate(date)}</Text>,
    },
  ];

  const activityIcons: Record<string, React.ReactNode> = {
    order: <ShoppingCartOutlined style={{ color: "#0f6fa8" }} />,
    browse: <ClockCircleOutlined style={{ color: "#d97706" }} />,
    account: <UserOutlined style={{ color: "#0ea5a4" }} />,
    review: <CheckCircleOutlined style={{ color: "#15803d" }} />,
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/customers")}
          style={{ marginBottom: 8, padding: 0 }}
        >
          Back to Customers
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 10, textAlign: "center" }}>
            <Avatar
              size={80}
              style={{ backgroundColor: "#0f6fa8", marginBottom: 16 }}
              icon={<UserOutlined />}
            />
            <Title level={4} style={{ margin: "0 0 4px" }}>
              {customer.name}
            </Title>
            <Tag
              color={segmentColors[customer.segment] || "default"}
              style={{
                borderRadius: 6,
                textTransform: "uppercase",
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              {customer.segment.replace(/-/g, " ")}
            </Tag>

            <Divider />

            <Space direction="vertical" size={12} style={{ width: "100%", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MailOutlined style={{ color: "#8c8c8c" }} />
                <Text style={{ fontSize: 13 }}>{customer.email}</Text>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PhoneOutlined style={{ color: "#8c8c8c" }} />
                <Text style={{ fontSize: 13 }}>{customer.phone}</Text>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarOutlined style={{ color: "#8c8c8c" }} />
                <Text style={{ fontSize: 13 }}>Member since {formatDate(customer.createdAt)}</Text>
              </div>
            </Space>

            <Divider />

            <Row gutter={[8, 16]}>
              <Col span={8}>
                <Statistic
                  title="Orders"
                  value={customer.totalOrders}
                  valueStyle={{ fontSize: 20, fontWeight: 700 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Spent"
                  value={customer.totalSpent}
                  prefix="$"
                  precision={0}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: "#0f6fa8" }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="AOV"
                  value={customer.avgOrderValue}
                  prefix="$"
                  precision={0}
                  valueStyle={{ fontSize: 20, fontWeight: 700 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Order History</Title>}
            style={{ borderRadius: 10, marginBottom: 16 }}
          >
            <Table
              dataSource={customerOrders}
              columns={orderColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>

          <Card
            title={<Title level={5} style={{ margin: 0 }}>Recent Activity</Title>}
            style={{ borderRadius: 10 }}
          >
            <Timeline
              items={activity.map((event) => ({
                dot: activityIcons[event.type] || <ClockCircleOutlined />,
                children: (
                  <div>
                    <Text style={{ fontSize: 13 }}>{event.action}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatDateTime(event.time)}
                    </Text>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CustomerShow;
