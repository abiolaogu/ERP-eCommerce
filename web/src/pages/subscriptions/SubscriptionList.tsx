import React, { useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Tabs,
  Tooltip,
  message,
  Select,
  Divider,
  Avatar,
  Badge,
  List,
  Descriptions,
  Popconfirm,
} from "antd";
import {
  SearchOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  CalendarOutlined,
  DollarOutlined,
  UserOutlined,
  CrownOutlined,
  RiseOutlined,
  FallOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
  MailOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";

const { Text } = Typography;

interface Subscription {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  plan: string;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  items: { name: string; quantity: number; price: number }[];
  total: number;
  nextDelivery: string;
  status: "active" | "paused" | "cancelled" | "past_due" | "trialing";
  startDate: string;
  billingCycles: number;
  paymentMethod: string;
  createdAt: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  frequency: string;
  subscribers: number;
  features: string[];
}

const mockSubscriptions: Subscription[] = [
  { id: "sub-1", customerId: "c1", customerName: "Sarah Johnson", customerEmail: "sarah.j@email.com", plan: "Premium Coffee Box", frequency: "monthly", items: [{ name: "Colombian Single Origin", quantity: 2, price: 18.99 }, { name: "Ethiopian Yirgacheffe", quantity: 1, price: 21.99 }], total: 59.97, nextDelivery: "2026-03-15", status: "active", startDate: "2025-06-15", billingCycles: 9, paymentMethod: "Visa *4242", createdAt: "2025-06-15" },
  { id: "sub-2", customerId: "c2", customerName: "Michael Chen", customerEmail: "m.chen@email.com", plan: "Wellness Bundle", frequency: "monthly", items: [{ name: "Organic Vitamins", quantity: 1, price: 34.99 }, { name: "Protein Powder", quantity: 1, price: 45.99 }], total: 80.98, nextDelivery: "2026-03-01", status: "active", startDate: "2025-09-01", billingCycles: 6, paymentMethod: "Mastercard *8910", createdAt: "2025-09-01" },
  { id: "sub-3", customerId: "c3", customerName: "Emily Davis", customerEmail: "emily.d@email.com", plan: "Skincare Essentials", frequency: "quarterly", items: [{ name: "Moisturizer", quantity: 1, price: 28.99 }, { name: "Cleanser", quantity: 1, price: 19.99 }, { name: "Serum", quantity: 1, price: 42.99 }], total: 91.97, nextDelivery: "2026-04-01", status: "active", startDate: "2025-07-01", billingCycles: 3, paymentMethod: "Visa *1234", createdAt: "2025-07-01" },
  { id: "sub-4", customerId: "c4", customerName: "James Wilson", customerEmail: "james.w@email.com", plan: "Snack Box", frequency: "biweekly", items: [{ name: "Mixed Nuts Pack", quantity: 2, price: 12.99 }, { name: "Dried Fruit Medley", quantity: 1, price: 9.99 }], total: 35.97, nextDelivery: "2026-03-07", status: "paused", startDate: "2025-11-15", billingCycles: 7, paymentMethod: "PayPal", createdAt: "2025-11-15" },
  { id: "sub-5", customerId: "c5", customerName: "Anna Martinez", customerEmail: "anna.m@email.com", plan: "Premium Coffee Box", frequency: "monthly", items: [{ name: "Dark Roast Blend", quantity: 3, price: 16.99 }], total: 50.97, nextDelivery: "2026-03-10", status: "active", startDate: "2025-10-10", billingCycles: 5, paymentMethod: "Visa *5678", createdAt: "2025-10-10" },
  { id: "sub-6", customerId: "c6", customerName: "David Kim", customerEmail: "david.k@email.com", plan: "Fitness Pack", frequency: "monthly", items: [{ name: "Protein Bars (12-pack)", quantity: 1, price: 29.99 }, { name: "BCAA Supplement", quantity: 1, price: 24.99 }], total: 54.98, nextDelivery: "2026-03-05", status: "past_due", startDate: "2025-08-05", billingCycles: 7, paymentMethod: "Visa *3456", createdAt: "2025-08-05" },
  { id: "sub-7", customerId: "c7", customerName: "Lisa Taylor", customerEmail: "lisa.t@email.com", plan: "Tea Connoisseur", frequency: "monthly", items: [{ name: "Green Tea Collection", quantity: 1, price: 22.99 }, { name: "Herbal Blend Set", quantity: 1, price: 18.99 }], total: 41.98, nextDelivery: "N/A", status: "cancelled", startDate: "2025-05-20", billingCycles: 8, paymentMethod: "Mastercard *7890", createdAt: "2025-05-20" },
  { id: "sub-8", customerId: "c8", customerName: "Robert Brown", customerEmail: "rob.b@email.com", plan: "Wellness Bundle", frequency: "monthly", items: [{ name: "Organic Vitamins", quantity: 1, price: 34.99 }, { name: "Fish Oil Capsules", quantity: 1, price: 19.99 }], total: 54.98, nextDelivery: "2026-03-20", status: "trialing", startDate: "2026-02-20", billingCycles: 0, paymentMethod: "Visa *2468", createdAt: "2026-02-20" },
  { id: "sub-9", customerId: "c9", customerName: "Karen White", customerEmail: "karen.w@email.com", plan: "Snack Box", frequency: "weekly", items: [{ name: "Organic Granola", quantity: 1, price: 8.99 }, { name: "Trail Mix", quantity: 2, price: 6.99 }], total: 22.97, nextDelivery: "2026-03-03", status: "active", startDate: "2026-01-06", billingCycles: 8, paymentMethod: "PayPal", createdAt: "2026-01-06" },
];

const mockPlans: SubscriptionPlan[] = [
  { id: "plan-1", name: "Premium Coffee Box", description: "Curated specialty coffee beans delivered fresh", price: 49.99, frequency: "monthly", subscribers: 156, features: ["3 specialty blends", "Freshly roasted", "Tasting notes included", "Free shipping"] },
  { id: "plan-2", name: "Wellness Bundle", description: "Essential supplements for daily wellness", price: 69.99, frequency: "monthly", subscribers: 98, features: ["Organic vitamins", "Personalized selection", "Quarterly health tips", "Cancel anytime"] },
  { id: "plan-3", name: "Skincare Essentials", description: "Premium skincare routine delivered quarterly", price: 89.99, frequency: "quarterly", subscribers: 72, features: ["3 full-size products", "Skin type matched", "Expert recommendations", "Exclusive products"] },
  { id: "plan-4", name: "Snack Box", description: "Healthy and delicious snacks", price: 29.99, frequency: "biweekly", subscribers: 234, features: ["8-10 snacks per box", "Mix of sweet & savory", "Allergy-friendly options", "New products each time"] },
  { id: "plan-5", name: "Fitness Pack", description: "Supplements to fuel your fitness goals", price: 54.99, frequency: "monthly", subscribers: 67, features: ["Protein supplements", "Recovery aids", "Workout guides", "Progress tracking"] },
];

const SubscriptionList: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("subscriptions");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [subscriptions, setSubscriptions] = useState(mockSubscriptions);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Subscription | null>(null);

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active").length;
    const paused = subscriptions.filter((s) => s.status === "paused").length;
    const cancelled = subscriptions.filter((s) => s.status === "cancelled").length;
    const mrr = subscriptions
      .filter((s) => s.status === "active" || s.status === "trialing")
      .reduce((sum, s) => {
        const monthlyValue = s.frequency === "weekly" ? s.total * 4.33 : s.frequency === "biweekly" ? s.total * 2.17 : s.frequency === "quarterly" ? s.total / 3 : s.frequency === "yearly" ? s.total / 12 : s.total;
        return sum + monthlyValue;
      }, 0);
    const churnRate = subscriptions.length > 0 ? (cancelled / subscriptions.length) * 100 : 0;
    const avgOrderValue = subscriptions.length > 0 ? subscriptions.reduce((s, sub) => s + sub.total, 0) / subscriptions.length : 0;
    return { active, paused, cancelled, mrr, churnRate, avgOrderValue };
  }, [subscriptions]);

  const filteredSubs = subscriptions.filter((s) => {
    const matchesSearch = !searchText || s.customerName.toLowerCase().includes(searchText.toLowerCase()) || s.plan.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handlePause = (id: string) => {
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "paused" as const } : s)));
    message.success("Subscription paused");
  };

  const handleResume = (id: string) => {
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "active" as const } : s)));
    message.success("Subscription resumed");
  };

  const handleCancel = (id: string) => {
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "cancelled" as const, nextDelivery: "N/A" } : s)));
    message.success("Subscription cancelled");
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    active: { color: "success", icon: <CheckCircleOutlined /> },
    paused: { color: "warning", icon: <PauseCircleOutlined /> },
    cancelled: { color: "error", icon: <CloseCircleOutlined /> },
    past_due: { color: "error", icon: <ClockCircleOutlined /> },
    trialing: { color: "processing", icon: <ThunderboltOutlined /> },
  };

  const freqLabels: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Every 2 Weeks",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };

  const columns = [
    {
      title: "Customer",
      key: "customer",
      width: 200,
      render: (_: unknown, record: Subscription) => (
        <Space>
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: "#0f6fa815", color: "#0f6fa8" }}>
            {record.customerName.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{record.customerName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{record.customerEmail}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Plan",
      dataIndex: "plan",
      key: "plan",
      width: 180,
      render: (plan: string) => <Text strong style={{ fontSize: 13 }}>{plan}</Text>,
    },
    {
      title: "Frequency",
      dataIndex: "frequency",
      key: "frequency",
      width: 120,
      render: (freq: string) => (
        <Tag icon={<ReloadOutlined />} style={{ borderRadius: 6 }}>
          {freqLabels[freq] || freq}
        </Tag>
      ),
    },
    {
      title: "Amount",
      dataIndex: "total",
      key: "total",
      width: 100,
      render: (val: number) => <Text strong style={{ color: "#0f6fa8" }}>{formatCurrency(val)}</Text>,
      sorter: (a: Subscription, b: Subscription) => a.total - b.total,
    },
    {
      title: "Next Delivery",
      dataIndex: "nextDelivery",
      key: "nextDelivery",
      width: 130,
      render: (date: string) => (
        <Text style={{ fontSize: 13 }}>
          {date === "N/A" ? <Text type="secondary">N/A</Text> : formatDate(date)}
        </Text>
      ),
    },
    {
      title: "Cycles",
      dataIndex: "billingCycles",
      key: "billingCycles",
      width: 80,
      render: (val: number) => <Badge count={val} style={{ backgroundColor: val > 0 ? "#0f6fa8" : "#d9d9d9" }} showZero />,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const c = statusConfig[status] || statusConfig.active;
        return (
          <Tag color={c.color} icon={c.icon} style={{ borderRadius: 6 }}>
            {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")}
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_: unknown, record: Subscription) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => { setDetailTarget(record); setDetailModalOpen(true); }}
            />
          </Tooltip>
          {record.status === "active" && (
            <Tooltip title="Pause">
              <Button
                type="text"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePause(record.id)}
              />
            </Tooltip>
          )}
          {record.status === "paused" && (
            <Tooltip title="Resume">
              <Button
                type="text"
                size="small"
                style={{ color: "#15803d" }}
                icon={<SyncOutlined />}
                onClick={() => handleResume(record.id)}
              />
            </Tooltip>
          )}
          {record.status !== "cancelled" && (
            <Popconfirm title="Cancel this subscription?" onConfirm={() => handleCancel(record.id)}>
              <Tooltip title="Cancel">
                <Button type="text" size="small" danger icon={<CloseCircleOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Subscription Management"
        subtitle="Manage recurring subscriptions, plans, and subscriber lifecycle"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Active Subs" value={stats.active} valueStyle={{ color: "#15803d" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Paused" value={stats.paused} valueStyle={{ color: "#d97706" }} prefix={<PauseCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="MRR" value={stats.mrr} precision={2} prefix="$" valueStyle={{ color: "#0f6fa8" }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Churn Rate"
              value={stats.churnRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: stats.churnRate > 10 ? "#dc2626" : "#15803d" }}
              prefix={<FallOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Cancelled" value={stats.cancelled} valueStyle={{ color: "#dc2626" }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Avg Order" value={stats.avgOrderValue} precision={2} prefix="$" />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
        items={[
          {
            key: "subscriptions",
            label: <span><SyncOutlined /> Subscriptions</span>,
            children: (
              <Card>
                <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Input
                    placeholder="Search by customer or plan..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 300, borderRadius: 8 }}
                    allowClear
                  />
                  <Select
                    placeholder="Filter by status"
                    allowClear
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 180 }}
                    options={[
                      { label: "Active", value: "active" },
                      { label: "Paused", value: "paused" },
                      { label: "Cancelled", value: "cancelled" },
                      { label: "Past Due", value: "past_due" },
                      { label: "Trialing", value: "trialing" },
                    ]}
                  />
                </div>
                <Table
                  dataSource={filteredSubs}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 1100 }}
                  pagination={{ pageSize: 10, showTotal: (total) => `${total} subscriptions` }}
                />
              </Card>
            ),
          },
          {
            key: "plans",
            label: <span><CrownOutlined /> Plans</span>,
            children: (
              <Row gutter={[16, 16]}>
                {mockPlans.map((plan) => (
                  <Col xs={24} sm={12} md={8} key={plan.id}>
                    <Card
                      hoverable
                      style={{ height: "100%" }}
                      actions={[
                        <Button type="text" key="edit" icon={<EditOutlined />}>Edit</Button>,
                        <Button type="text" key="view">
                          {plan.subscribers} subscribers
                        </Button>,
                      ]}
                    >
                      <Space orientation="vertical" style={{ width: "100%" }} size={12}>
                        <div>
                          <Text strong style={{ fontSize: 16 }}>{plan.name}</Text>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{plan.description}</Text>
                          </div>
                        </div>
                        <div>
                          <Text strong style={{ fontSize: 24, color: "#0f6fa8" }}>{formatCurrency(plan.price)}</Text>
                          <Text type="secondary"> / {plan.frequency}</Text>
                        </div>
                        <Divider style={{ margin: "4px 0" }} />
                        <List
                          size="small"
                          dataSource={plan.features}
                          renderItem={(feat) => (
                            <List.Item style={{ padding: "4px 0", border: "none" }}>
                              <Space size={4}>
                                <CheckCircleOutlined style={{ color: "#15803d", fontSize: 12 }} />
                                <Text style={{ fontSize: 12 }}>{feat}</Text>
                              </Space>
                            </List.Item>
                          )}
                        />
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title="Subscription Details"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={
          detailTarget && detailTarget.status !== "cancelled" ? (
            <Space>
              <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
              {detailTarget.status === "active" && (
                <Button icon={<PauseCircleOutlined />} onClick={() => { handlePause(detailTarget.id); setDetailModalOpen(false); }}>
                  Pause
                </Button>
              )}
              {detailTarget.status === "paused" && (
                <Button type="primary" icon={<SyncOutlined />} onClick={() => { handleResume(detailTarget.id); setDetailModalOpen(false); }}>
                  Resume
                </Button>
              )}
              <Popconfirm title="Cancel subscription?" onConfirm={() => { handleCancel(detailTarget.id); setDetailModalOpen(false); }}>
                <Button danger icon={<CloseCircleOutlined />}>Cancel</Button>
              </Popconfirm>
            </Space>
          ) : null
        }
        width={560}
      >
        {detailTarget && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Customer">{detailTarget.customerName}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailTarget.customerEmail}</Descriptions.Item>
              <Descriptions.Item label="Plan">{detailTarget.plan}</Descriptions.Item>
              <Descriptions.Item label="Frequency">{freqLabels[detailTarget.frequency]}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusConfig[detailTarget.status]?.color} icon={statusConfig[detailTarget.status]?.icon}>
                  {detailTarget.status.charAt(0).toUpperCase() + detailTarget.status.slice(1).replace(/_/g, " ")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Amount">{formatCurrency(detailTarget.total)}</Descriptions.Item>
              <Descriptions.Item label="Start Date">{formatDate(detailTarget.startDate)}</Descriptions.Item>
              <Descriptions.Item label="Next Delivery">{detailTarget.nextDelivery === "N/A" ? "N/A" : formatDate(detailTarget.nextDelivery)}</Descriptions.Item>
              <Descriptions.Item label="Billing Cycles">{detailTarget.billingCycles}</Descriptions.Item>
              <Descriptions.Item label="Payment">{detailTarget.paymentMethod}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="Subscription Items">
              <List
                size="small"
                dataSource={detailTarget.items}
                renderItem={(item) => (
                  <List.Item extra={<Text strong>{formatCurrency(item.price * item.quantity)}</Text>}>
                    <List.Item.Meta title={item.name} description={`Qty: ${item.quantity} x ${formatCurrency(item.price)}`} />
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default SubscriptionList;
