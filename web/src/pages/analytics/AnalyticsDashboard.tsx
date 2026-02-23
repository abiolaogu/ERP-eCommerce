import React, { useState } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Select,
  Statistic,
  Table,
  Progress,
  Space,
  List,
  Avatar,
  Tag,
  Divider,
} from "antd";
import {
  DollarOutlined,
  ShoppingCartOutlined,
  RiseOutlined,
  UserAddOutlined,
  ShopOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { KPICard } from "@/components/common/KPICard";
import { formatCurrency, formatNumber, formatPercentage } from "@/utils/formatters";

const { Title, Text } = Typography;

const kpiData = [
  {
    title: "Total Revenue",
    value: "$128,450",
    change: 18.5,
    changeLabel: "vs last month",
    icon: <DollarOutlined />,
    color: "#0f6fa8",
  },
  {
    title: "Total Orders",
    value: "2,847",
    change: 12.3,
    changeLabel: "vs last month",
    icon: <ShoppingCartOutlined />,
    color: "#0ea5a4",
  },
  {
    title: "Average Order Value",
    value: "$45.12",
    change: 5.7,
    changeLabel: "vs last month",
    icon: <RiseOutlined />,
    color: "#15803d",
  },
  {
    title: "New Customers",
    value: 342,
    change: 22.1,
    changeLabel: "vs last month",
    icon: <UserAddOutlined />,
    color: "#d97706",
  },
];

const revenueTrend = [
  { month: "Sep", revenue: 42300, orders: 890 },
  { month: "Oct", revenue: 51200, orders: 1023 },
  { month: "Nov", revenue: 68900, orders: 1456 },
  { month: "Dec", revenue: 95400, orders: 2134 },
  { month: "Jan", revenue: 108300, orders: 2410 },
  { month: "Feb", revenue: 128450, orders: 2847 },
];

const topCategories = [
  { name: "Electronics", revenue: 48200, orders: 856, share: 37.5 },
  { name: "Clothing", revenue: 32100, orders: 1245, share: 25.0 },
  { name: "Sports & Outdoors", revenue: 22400, orders: 567, share: 17.4 },
  { name: "Home & Garden", revenue: 15800, orders: 412, share: 12.3 },
  { name: "Books & Media", revenue: 9950, orders: 367, share: 7.8 },
];

const topProducts = [
  { rank: 1, name: "Wireless Headphones Pro", sku: "WHP-001", revenue: 22450, units: 150, growth: 24.5 },
  { rank: 2, name: "Smart Watch Series 5", sku: "SWS-003", revenue: 17940, units: 60, growth: 18.2 },
  { rank: 3, name: "Running Shoes Ultra", sku: "RSU-004", revenue: 14400, units: 120, growth: 12.7 },
  { rank: 4, name: "Organic Cotton T-Shirt", sku: "OCT-002", revenue: 12300, units: 410, growth: -3.4 },
  { rank: 5, name: "Portable Bluetooth Speaker", sku: "PBS-005", revenue: 10800, units: 180, growth: 8.9 },
  { rank: 6, name: "Yoga Mat Professional", sku: "YMP-007", revenue: 8000, units: 200, growth: 31.2 },
  { rank: 7, name: "Leather Wallet Premium", sku: "LWP-006", revenue: 6500, units: 130, growth: 5.1 },
  { rank: 8, name: "Stainless Steel Bottle", sku: "SSW-008", revenue: 4500, units: 180, growth: -8.3 },
];

const customerAcquisition = [
  { month: "Sep", newCustomers: 120, returning: 340 },
  { month: "Oct", newCustomers: 156, returning: 389 },
  { month: "Nov", newCustomers: 210, returning: 456 },
  { month: "Dec", newCustomers: 298, returning: 612 },
  { month: "Jan", newCustomers: 312, returning: 578 },
  { month: "Feb", newCustomers: 342, returning: 623 },
];

const categoryColors = ["#0f6fa8", "#0ea5a4", "#15803d", "#d97706", "#dc2626"];

const AnalyticsDashboard: React.FC = () => {
  const [period, setPeriod] = useState("30d");

  const productColumns = [
    {
      title: "#",
      dataIndex: "rank",
      key: "rank",
      width: 50,
      render: (rank: number) => {
        const medals: Record<number, React.ReactNode> = {
          1: <TrophyOutlined style={{ color: "#d4af37", fontSize: 16 }} />,
          2: <TrophyOutlined style={{ color: "#c0c0c0", fontSize: 16 }} />,
          3: <TrophyOutlined style={{ color: "#cd7f32", fontSize: 16 }} />,
        };
        return medals[rank] || <Text type="secondary">{rank}</Text>;
      },
    },
    {
      title: "Product",
      key: "product",
      render: (_: unknown, record: { name: string; sku: string }) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{record.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>SKU: {record.sku}</Text>
        </div>
      ),
    },
    {
      title: "Revenue",
      dataIndex: "revenue",
      key: "revenue",
      render: (val: number) => <Text strong>{formatCurrency(val)}</Text>,
      sorter: (a: { revenue: number }, b: { revenue: number }) => a.revenue - b.revenue,
    },
    {
      title: "Units Sold",
      dataIndex: "units",
      key: "units",
      render: (val: number) => formatNumber(val),
    },
    {
      title: "Growth",
      dataIndex: "growth",
      key: "growth",
      render: (val: number) => (
        <Space>
          {val >= 0 ? (
            <ArrowUpOutlined style={{ color: "#15803d", fontSize: 11 }} />
          ) : (
            <ArrowDownOutlined style={{ color: "#dc2626", fontSize: 11 }} />
          )}
          <Text style={{ color: val >= 0 ? "#15803d" : "#dc2626", fontWeight: 500, fontSize: 13 }}>
            {formatPercentage(Math.abs(val))}
          </Text>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Sales performance, product insights, and customer trends"
        extra={
          <Select
            value={period}
            onChange={setPeriod}
            style={{ width: 140 }}
            options={[
              { label: "Last 7 days", value: "7d" },
              { label: "Last 30 days", value: "30d" },
              { label: "Last 90 days", value: "90d" },
              { label: "This year", value: "ytd" },
            ]}
          />
        }
      />

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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Revenue Trend</Title>}
            style={{ borderRadius: 10, height: "100%" }}
          >
            <Table
              dataSource={revenueTrend}
              rowKey="month"
              pagination={false}
              size="small"
              columns={[
                { title: "Month", dataIndex: "month", key: "month" },
                {
                  title: "Revenue",
                  dataIndex: "revenue",
                  key: "revenue",
                  render: (val: number) => <Text strong>{formatCurrency(val)}</Text>,
                },
                {
                  title: "Orders",
                  dataIndex: "orders",
                  key: "orders",
                  render: (val: number) => formatNumber(val),
                },
                {
                  title: "Visual",
                  key: "bar",
                  render: (_: unknown, record: { revenue: number }) => (
                    <Progress
                      percent={Math.round((record.revenue / 130000) * 100)}
                      showInfo={false}
                      strokeColor="#0f6fa8"
                      size="small"
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Top Categories</Title>}
            style={{ borderRadius: 10, height: "100%" }}
          >
            <List
              dataSource={topCategories}
              renderItem={(item, index) => (
                <List.Item style={{ padding: "12px 0" }}>
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <Space>
                        <Avatar
                          size={24}
                          style={{
                            backgroundColor: `${categoryColors[index]}20`,
                            color: categoryColors[index],
                            fontSize: 11,
                          }}
                          icon={<ShopOutlined />}
                        />
                        <Text strong style={{ fontSize: 13 }}>{item.name}</Text>
                      </Space>
                      <Space>
                        <Text strong style={{ fontSize: 13, color: "#0f6fa8" }}>
                          {formatCurrency(item.revenue)}
                        </Text>
                        <Tag style={{ borderRadius: 6, fontSize: 11 }}>
                          {item.share}%
                        </Tag>
                      </Space>
                    </div>
                    <Progress
                      percent={item.share}
                      showInfo={false}
                      strokeColor={categoryColors[index]}
                      size="small"
                    />
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Top Products by Revenue</Title>}
            style={{ borderRadius: 10 }}
          >
            <Table
              dataSource={topProducts}
              columns={productColumns}
              rowKey="rank"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Customer Acquisition</Title>}
            style={{ borderRadius: 10 }}
          >
            <Table
              dataSource={customerAcquisition}
              rowKey="month"
              pagination={false}
              size="small"
              columns={[
                { title: "Month", dataIndex: "month", key: "month" },
                {
                  title: "New",
                  dataIndex: "newCustomers",
                  key: "newCustomers",
                  render: (val: number) => (
                    <Tag color="green" style={{ borderRadius: 6 }}>
                      +{formatNumber(val)}
                    </Tag>
                  ),
                },
                {
                  title: "Returning",
                  dataIndex: "returning",
                  key: "returning",
                  render: (val: number) => formatNumber(val),
                },
                {
                  title: "Ratio",
                  key: "ratio",
                  render: (_: unknown, record: { newCustomers: number; returning: number }) => {
                    const total = record.newCustomers + record.returning;
                    const newPct = Math.round((record.newCustomers / total) * 100);
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Progress
                          percent={newPct}
                          showInfo={false}
                          strokeColor="#15803d"
                          trailColor="#0f6fa830"
                          size="small"
                          style={{ width: 60 }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {newPct}% new
                        </Text>
                      </div>
                    );
                  },
                },
              ]}
            />

            <Divider />

            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="Total New Customers"
                  value={customerAcquisition.reduce((sum, m) => sum + m.newCustomers, 0)}
                  prefix={<UserAddOutlined />}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Retention Rate"
                  value={68.4}
                  suffix="%"
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: "#0f6fa8" }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsDashboard;
