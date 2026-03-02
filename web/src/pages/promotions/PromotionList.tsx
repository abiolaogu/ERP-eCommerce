import React, { useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  InputNumber,
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Tabs,
  Tooltip,
  message,
  DatePicker,
  Switch,
  Divider,
  Progress,
  Badge,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  GiftOutlined,
  PercentageOutlined,
  DollarOutlined,
  TagOutlined,
  CalendarOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  ShoppingCartOutlined,
  CarOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";

const { Text } = Typography;

interface Promotion {
  id: string;
  name: string;
  type: "percentage" | "fixed" | "bogo" | "free_shipping";
  discountValue: number;
  couponCode?: string;
  minOrderAmount?: number;
  usageLimit?: number;
  usageCount: number;
  applicableProducts: string;
  applicableCategories: string[];
  startDate: string;
  endDate: string;
  status: "active" | "scheduled" | "expired" | "disabled";
  createdAt: string;
}

const mockPromotions: Promotion[] = [
  { id: "1", name: "Spring Sale 2026", type: "percentage", discountValue: 25, couponCode: "SPRING25", minOrderAmount: 50, usageLimit: 1000, usageCount: 342, applicableProducts: "All Products", applicableCategories: ["electronics", "clothing"], startDate: "2026-02-01", endDate: "2026-03-31", status: "active", createdAt: "2026-01-25" },
  { id: "2", name: "Free Shipping Weekend", type: "free_shipping", discountValue: 0, couponCode: undefined, minOrderAmount: 30, usageLimit: undefined, usageCount: 1253, applicableProducts: "All Products", applicableCategories: [], startDate: "2026-02-28", endDate: "2026-03-02", status: "active", createdAt: "2026-02-20" },
  { id: "3", name: "Buy One Get One Headphones", type: "bogo", discountValue: 100, couponCode: "BOGO-HP", minOrderAmount: undefined, usageLimit: 200, usageCount: 87, applicableProducts: "Wireless Headphones Pro", applicableCategories: ["electronics"], startDate: "2026-02-15", endDate: "2026-03-15", status: "active", createdAt: "2026-02-10" },
  { id: "4", name: "New Customer $10 Off", type: "fixed", discountValue: 10, couponCode: "WELCOME10", minOrderAmount: 25, usageLimit: 5000, usageCount: 2341, applicableProducts: "All Products", applicableCategories: [], startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: "2025-12-20" },
  { id: "5", name: "Holiday Flash Sale", type: "percentage", discountValue: 40, couponCode: "HOLIDAY40", minOrderAmount: 100, usageLimit: 500, usageCount: 500, applicableProducts: "Selected Items", applicableCategories: ["electronics", "home-garden"], startDate: "2025-12-20", endDate: "2026-01-05", status: "expired", createdAt: "2025-12-15" },
  { id: "6", name: "Sports Equipment 15% Off", type: "percentage", discountValue: 15, couponCode: "SPORT15", minOrderAmount: undefined, usageLimit: 800, usageCount: 650, applicableProducts: "All Sports Products", applicableCategories: ["sports"], startDate: "2026-01-15", endDate: "2026-02-15", status: "expired", createdAt: "2026-01-10" },
  { id: "7", name: "Summer Preview", type: "percentage", discountValue: 20, couponCode: "SUMMER20", minOrderAmount: 75, usageLimit: 2000, usageCount: 0, applicableProducts: "All Products", applicableCategories: [], startDate: "2026-04-01", endDate: "2026-06-30", status: "scheduled", createdAt: "2026-02-25" },
  { id: "8", name: "VIP Members Exclusive", type: "fixed", discountValue: 25, couponCode: "VIP25OFF", minOrderAmount: 50, usageLimit: 300, usageCount: 112, applicableProducts: "All Products", applicableCategories: [], startDate: "2026-02-01", endDate: "2026-04-30", status: "active", createdAt: "2026-01-28" },
];

const typeIcons: Record<string, React.ReactNode> = {
  percentage: <PercentageOutlined />,
  fixed: <DollarOutlined />,
  bogo: <GiftOutlined />,
  free_shipping: <CarOutlined />,
};

const typeLabels: Record<string, string> = {
  percentage: "Percentage Off",
  fixed: "Fixed Amount",
  bogo: "Buy One Get One",
  free_shipping: "Free Shipping",
};

const typeColors: Record<string, string> = {
  percentage: "blue",
  fixed: "green",
  bogo: "purple",
  free_shipping: "cyan",
};

const PromotionList: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [promotions, setPromotions] = useState(mockPromotions);
  const [form] = Form.useForm();

  const filteredPromotions = promotions.filter((p) => {
    const matchesSearch = !searchText || p.name.toLowerCase().includes(searchText.toLowerCase()) || (p.couponCode || "").toLowerCase().includes(searchText.toLowerCase());
    const matchesTab = activeTab === "all" || p.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const stats = {
    active: promotions.filter((p) => p.status === "active").length,
    scheduled: promotions.filter((p) => p.status === "scheduled").length,
    expired: promotions.filter((p) => p.status === "expired").length,
    totalRedemptions: promotions.reduce((s, p) => s + p.usageCount, 0),
  };

  const handleCreate = () => {
    form.validateFields().then((values) => {
      const newPromo: Promotion = {
        id: `promo-${Date.now()}`,
        name: values.name,
        type: values.type,
        discountValue: values.discountValue || 0,
        couponCode: values.couponCode,
        minOrderAmount: values.minOrderAmount,
        usageLimit: values.usageLimit,
        usageCount: 0,
        applicableProducts: values.applicableProducts || "All Products",
        applicableCategories: values.applicableCategories || [],
        startDate: values.dateRange?.[0]?.format("YYYY-MM-DD") || "2026-03-01",
        endDate: values.dateRange?.[1]?.format("YYYY-MM-DD") || "2026-03-31",
        status: "scheduled",
        createdAt: new Date().toISOString(),
      };
      setPromotions((prev) => [newPromo, ...prev]);
      setCreateModalOpen(false);
      form.resetFields();
      message.success(`Promotion "${values.name}" created`);
    });
  };

  const handleToggleStatus = (id: string) => {
    setPromotions((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "active" ? "disabled" : "active" }
          : p
      )
    );
    message.success("Promotion status updated");
  };

  const columns = [
    {
      title: "Promotion",
      key: "promotion",
      width: 280,
      render: (_: unknown, record: Promotion) => (
        <div>
          <Space>
            <Text strong style={{ fontSize: 14 }}>{record.name}</Text>
          </Space>
          <br />
          {record.couponCode && (
            <Space size={4} style={{ marginTop: 4 }}>
              <Tag
                style={{ borderRadius: 4, fontFamily: "monospace", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                color="default"
                onClick={() => {
                  navigator.clipboard.writeText(record.couponCode!);
                  message.success("Coupon code copied!");
                }}
              >
                <CopyOutlined /> {record.couponCode}
              </Tag>
            </Space>
          )}
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 160,
      render: (type: string) => (
        <Tag icon={typeIcons[type]} color={typeColors[type]} style={{ borderRadius: 6 }}>
          {typeLabels[type]}
        </Tag>
      ),
    },
    {
      title: "Discount",
      key: "discount",
      width: 120,
      render: (_: unknown, record: Promotion) => (
        <Text strong style={{ fontSize: 14, color: "#0f6fa8" }}>
          {record.type === "percentage"
            ? `${record.discountValue}%`
            : record.type === "fixed"
            ? formatCurrency(record.discountValue)
            : record.type === "bogo"
            ? "BOGO"
            : "Free"}
        </Text>
      ),
    },
    {
      title: "Conditions",
      key: "conditions",
      width: 180,
      render: (_: unknown, record: Promotion) => (
        <Space orientation="vertical" size={2}>
          {record.minOrderAmount && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Min order: {formatCurrency(record.minOrderAmount)}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.applicableProducts}
          </Text>
        </Space>
      ),
    },
    {
      title: "Usage",
      key: "usage",
      width: 160,
      render: (_: unknown, record: Promotion) => (
        <Space orientation="vertical" size={2} style={{ width: "100%" }}>
          <Text style={{ fontSize: 13 }}>
            {formatNumber(record.usageCount)}
            {record.usageLimit ? ` / ${formatNumber(record.usageLimit)}` : ""}
          </Text>
          {record.usageLimit && (
            <Progress
              percent={Math.round((record.usageCount / record.usageLimit) * 100)}
              size="small"
              showInfo={false}
              strokeColor={record.usageCount >= record.usageLimit ? "#dc2626" : "#0f6fa8"}
              style={{ margin: 0 }}
            />
          )}
        </Space>
      ),
    },
    {
      title: "Date Range",
      key: "dates",
      width: 180,
      render: (_: unknown, record: Promotion) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {formatDate(record.startDate)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>to {formatDate(record.endDate)}</Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactNode }> = {
          active: { color: "success", icon: <CheckCircleOutlined /> },
          scheduled: { color: "processing", icon: <ClockCircleOutlined /> },
          expired: { color: "default", icon: <CloseCircleOutlined /> },
          disabled: { color: "error", icon: <CloseCircleOutlined /> },
        };
        const c = config[status] || config.active;
        return (
          <Tag color={c.color} icon={c.icon} style={{ borderRadius: 6 }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: Promotion) => (
        <Space>
          <Tooltip title={record.status === "active" ? "Disable" : "Enable"}>
            <Switch
              size="small"
              checked={record.status === "active"}
              onChange={() => handleToggleStatus(record.id)}
              disabled={record.status === "expired"}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setPromotions((prev) => prev.filter((p) => p.id !== record.id));
                message.success("Promotion deleted");
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Promotions & Coupons"
        subtitle="Create and manage promotional campaigns, discounts, and coupon codes"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create Promotion
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Active Promotions" value={stats.active} valueStyle={{ color: "#15803d" }} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Scheduled" value={stats.scheduled} valueStyle={{ color: "#0f6fa8" }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Expired" value={stats.expired} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total Redemptions" value={stats.totalRedemptions} prefix={<TagOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 16 }}
          items={[
            { key: "active", label: <span><CheckCircleOutlined /> Active ({stats.active})</span> },
            { key: "scheduled", label: <span><ClockCircleOutlined /> Scheduled ({stats.scheduled})</span> },
            { key: "expired", label: <span><CloseCircleOutlined /> Expired ({stats.expired})</span> },
            { key: "all", label: "All" },
          ]}
        />

        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="Search promotions or coupon codes..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 320, borderRadius: 8 }}
            allowClear
          />
        </div>

        <Table
          dataSource={filteredPromotions}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} promotions` }}
        />
      </Card>

      <Modal
        title="Create Promotion"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        width={600}
        okText="Create Promotion"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Promotion Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., Summer Sale 2026" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Discount Type" rules={[{ required: true }]}>
                <Select
                  placeholder="Select type"
                  options={[
                    { label: "Percentage Off", value: "percentage" },
                    { label: "Fixed Amount", value: "fixed" },
                    { label: "Buy One Get One", value: "bogo" },
                    { label: "Free Shipping", value: "free_shipping" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="discountValue" label="Discount Value">
                <InputNumber min={0} style={{ width: "100%" }} placeholder="e.g., 25" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="couponCode" label="Coupon Code">
                <Input placeholder="e.g., SAVE25" style={{ fontFamily: "monospace" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="minOrderAmount" label="Min Order Amount">
                <InputNumber min={0} prefix="$" style={{ width: "100%" }} placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="usageLimit" label="Usage Limit">
                <InputNumber min={1} style={{ width: "100%" }} placeholder="Unlimited" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="applicableCategories" label="Categories">
                <Select
                  mode="multiple"
                  placeholder="All categories"
                  options={[
                    { label: "Electronics", value: "electronics" },
                    { label: "Clothing", value: "clothing" },
                    { label: "Sports", value: "sports" },
                    { label: "Home & Garden", value: "home-garden" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PromotionList;
