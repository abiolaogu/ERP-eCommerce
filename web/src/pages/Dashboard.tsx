import React from "react";
import { Row, Col, Card, Table, Typography, Space, List, Avatar, Progress } from "antd";
import {
  DollarOutlined,
  ShoppingCartOutlined,
  RiseOutlined,
  PercentageOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { KPICard } from "@/components/common/KPICard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatRelativeTime } from "@/utils/formatters";

const { Text, Title } = Typography;

const kpiData = [
  {
    title: "Total Revenue",
    value: "$48,294",
    change: 14.2,
    changeLabel: "vs last month",
    icon: <DollarOutlined />,
    color: "#0f6fa8",
  },
  {
    title: "Orders Today",
    value: 156,
    change: 5.8,
    changeLabel: "vs yesterday",
    icon: <ShoppingCartOutlined />,
    color: "#0ea5a4",
  },
  {
    title: "Avg Order Value",
    value: "$67.50",
    change: 3.1,
    changeLabel: "vs last week",
    icon: <RiseOutlined />,
    color: "#15803d",
  },
  {
    title: "Conversion Rate",
    value: "3.8%",
    change: -0.3,
    changeLabel: "vs last week",
    icon: <PercentageOutlined />,
    color: "#d97706",
  },
];

const topProducts = [
  { name: "Wireless Headphones Pro", revenue: 12450, units: 245, image: "" },
  { name: "Organic Cotton T-Shirt", revenue: 8930, units: 412, image: "" },
  { name: "Smart Watch Series 5", revenue: 7820, units: 98, image: "" },
  { name: "Running Shoes Ultra", revenue: 6540, units: 178, image: "" },
  { name: "Portable Bluetooth Speaker", revenue: 5210, units: 320, image: "" },
];

const recentOrders = [
  { id: "1", orderNumber: "ORD-2024-0891", customerName: "Sarah Johnson", total: 234.50, currency: "USD", status: "pending", createdAt: new Date(Date.now() - 120000).toISOString() },
  { id: "2", orderNumber: "ORD-2024-0890", customerName: "Michael Chen", total: 89.99, currency: "USD", status: "confirmed", createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: "3", orderNumber: "ORD-2024-0889", customerName: "Emily Davis", total: 445.00, currency: "USD", status: "shipped", createdAt: new Date(Date.now() - 600000).toISOString() },
  { id: "4", orderNumber: "ORD-2024-0888", customerName: "James Wilson", total: 67.25, currency: "USD", status: "delivered", createdAt: new Date(Date.now() - 1200000).toISOString() },
  { id: "5", orderNumber: "ORD-2024-0887", customerName: "Lisa Anderson", total: 312.00, currency: "USD", status: "confirmed", createdAt: new Date(Date.now() - 1800000).toISOString() },
];

const orderColumns = [
  {
    title: "Order",
    dataIndex: "orderNumber",
    key: "orderNumber",
    render: (text: string) => <Text strong style={{ fontSize: 13 }}>#{text}</Text>,
  },
  {
    title: "Customer",
    dataIndex: "customerName",
    key: "customerName",
    render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>,
  },
  {
    title: "Total",
    dataIndex: "total",
    key: "total",
    render: (amount: number, record: { currency: string }) => (
      <Text strong style={{ fontSize: 13 }}>
        {formatCurrency(amount, record.currency)}
      </Text>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: string) => <StatusBadge status={status} />,
  },
  {
    title: "Time",
    dataIndex: "createdAt",
    key: "createdAt",
    render: (date: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {formatRelativeTime(date)}
      </Text>
    ),
  },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Commerce performance overview and real-time metrics" />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpiData.map((kpi, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <KPICard
              title={kpi.title}
              value={kpi.value}
              change={kpi.change}
              changeLabel={kpi.changeLabel}
              icon={kpi.icon}
              color={kpi.color}
            />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                Recent Orders
              </Title>
            }
            extra={
              <a onClick={() => navigate("/orders")} style={{ fontSize: 13 }}>
                View All
              </a>
            }
            style={{ borderRadius: 10, height: "100%" }}
          >
            <Table
              dataSource={recentOrders}
              columns={orderColumns}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => navigate(`/orders/${record.id}`),
                style: { cursor: "pointer" },
              })}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                Top Products
              </Title>
            }
            extra={
              <a onClick={() => navigate("/products")} style={{ fontSize: 13 }}>
                View All
              </a>
            }
            style={{ borderRadius: 10, height: "100%" }}
          >
            <List
              dataSource={topProducts}
              renderItem={(item, index) => (
                <List.Item style={{ padding: "12px 0" }}>
                  <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar
                      shape="square"
                      size={40}
                      style={{
                        backgroundColor: `${["#0f6fa8", "#0ea5a4", "#15803d", "#d97706", "#dc2626"][index]}15`,
                        color: ["#0f6fa8", "#0ea5a4", "#15803d", "#d97706", "#dc2626"][index],
                        borderRadius: 8,
                      }}
                      icon={<ShopOutlined />}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text strong style={{ fontSize: 13 }} ellipsis>
                          {item.name}
                        </Text>
                        <Text strong style={{ fontSize: 13, color: "#0f6fa8" }}>
                          {formatCurrency(item.revenue)}
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.units} units sold
                      </Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
