import React, { useState, useMemo } from "react";
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
  Tooltip,
  message,
  Badge,
  Divider,
  Progress,
  Avatar,
  List,
} from "antd";
import {
  UserOutlined,
  CrownOutlined,
  HeartOutlined,
  WarningOutlined,
  QuestionCircleOutlined,
  StarOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  PlusOutlined,
  TeamOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  MailOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber } from "@/utils/formatters";

const { Text, Title, Paragraph } = Typography;

interface Segment {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  customerCount: number;
  avgOrderValue: number;
  totalRevenue: number;
  avgOrdersPerCustomer: number;
  retentionRate: number;
  rfmScores: { recency: number; frequency: number; monetary: number };
  suggestedActions: string[];
  trend: "up" | "down" | "stable";
  trendValue: number;
}

interface CustomerInSegment {
  id: string;
  name: string;
  email: string;
  segment: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  rfmScore: string;
  ltv: number;
}

const mockSegments: Segment[] = [
  {
    id: "seg-1", name: "Champions", description: "High-spending, frequent, recent buyers. Your best customers.",
    icon: <CrownOutlined />, color: "#7c3aed", bgColor: "#7c3aed10",
    customerCount: 245, avgOrderValue: 189.50, totalRevenue: 285420, avgOrdersPerCustomer: 12.3, retentionRate: 96.5,
    rfmScores: { recency: 5, frequency: 5, monetary: 5 },
    suggestedActions: ["Offer VIP perks and early access", "Request referrals and reviews", "Cross-sell premium products"],
    trend: "up", trendValue: 8.2,
  },
  {
    id: "seg-2", name: "Loyal Customers", description: "Buy regularly with good frequency. Responsive to promotions.",
    icon: <HeartOutlined />, color: "#0f6fa8", bgColor: "#0f6fa810",
    customerCount: 567, avgOrderValue: 95.30, totalRevenue: 324560, avgOrdersPerCustomer: 6.8, retentionRate: 82.3,
    rfmScores: { recency: 4, frequency: 4, monetary: 4 },
    suggestedActions: ["Upsell higher-value products", "Loyalty program rewards", "Personalized recommendations"],
    trend: "up", trendValue: 3.5,
  },
  {
    id: "seg-3", name: "Potential Loyalists", description: "Recent customers with above-average frequency. Growing engagement.",
    icon: <RiseOutlined />, color: "#15803d", bgColor: "#15803d10",
    customerCount: 389, avgOrderValue: 72.80, totalRevenue: 145890, avgOrdersPerCustomer: 3.2, retentionRate: 68.7,
    rfmScores: { recency: 4, frequency: 3, monetary: 3 },
    suggestedActions: ["Membership or loyalty program offer", "Product recommendations based on history", "Engage with relevant content"],
    trend: "up", trendValue: 12.1,
  },
  {
    id: "seg-4", name: "At Risk", description: "Used to be active but have not purchased recently. Need re-engagement.",
    icon: <WarningOutlined />, color: "#d97706", bgColor: "#d9770610",
    customerCount: 312, avgOrderValue: 65.40, totalRevenue: 98760, avgOrdersPerCustomer: 4.1, retentionRate: 42.5,
    rfmScores: { recency: 2, frequency: 3, monetary: 3 },
    suggestedActions: ["Win-back email campaign", "Exclusive discount offer", "Survey to understand disengagement"],
    trend: "down", trendValue: 5.8,
  },
  {
    id: "seg-5", name: "Lost Customers", description: "Have not purchased in a long time. Low engagement across channels.",
    icon: <FallOutlined />, color: "#dc2626", bgColor: "#dc262610",
    customerCount: 478, avgOrderValue: 45.20, totalRevenue: 56780, avgOrdersPerCustomer: 1.8, retentionRate: 8.3,
    rfmScores: { recency: 1, frequency: 1, monetary: 2 },
    suggestedActions: ["Aggressive re-engagement campaign", "Major discount or free shipping", "Consider removing from active lists"],
    trend: "down", trendValue: 2.3,
  },
  {
    id: "seg-6", name: "New Customers", description: "First-time buyers. Critical to nurture into repeat customers.",
    icon: <StarOutlined />, color: "#0891b2", bgColor: "#0891b210",
    customerCount: 634, avgOrderValue: 58.90, totalRevenue: 89450, avgOrdersPerCustomer: 1.2, retentionRate: 35.6,
    rfmScores: { recency: 5, frequency: 1, monetary: 2 },
    suggestedActions: ["Welcome email series", "First repeat purchase discount", "Product education and guides"],
    trend: "up", trendValue: 15.4,
  },
];

const mockCustomers: CustomerInSegment[] = [
  { id: "c1", name: "Sarah Johnson", email: "sarah.j@email.com", segment: "Champions", totalOrders: 28, totalSpent: 4250.80, lastOrderDate: "2026-02-27", rfmScore: "5-5-5", ltv: 6800 },
  { id: "c2", name: "Michael Chen", email: "m.chen@email.com", segment: "Champions", totalOrders: 19, totalSpent: 3120.50, lastOrderDate: "2026-02-25", rfmScore: "5-5-4", ltv: 5200 },
  { id: "c3", name: "Emily Davis", email: "emily.d@email.com", segment: "Loyal Customers", totalOrders: 12, totalSpent: 1450.30, lastOrderDate: "2026-02-20", rfmScore: "4-4-3", ltv: 2800 },
  { id: "c4", name: "James Wilson", email: "james.w@email.com", segment: "Loyal Customers", totalOrders: 9, totalSpent: 980.60, lastOrderDate: "2026-02-18", rfmScore: "4-3-3", ltv: 1900 },
  { id: "c5", name: "Anna Martinez", email: "anna.m@email.com", segment: "At Risk", totalOrders: 6, totalSpent: 520.40, lastOrderDate: "2026-01-05", rfmScore: "2-3-2", ltv: 750 },
  { id: "c6", name: "David Kim", email: "david.k@email.com", segment: "New Customers", totalOrders: 1, totalSpent: 89.99, lastOrderDate: "2026-02-26", rfmScore: "5-1-1", ltv: 180 },
  { id: "c7", name: "Lisa Taylor", email: "lisa.t@email.com", segment: "Lost Customers", totalOrders: 2, totalSpent: 120.80, lastOrderDate: "2025-08-15", rfmScore: "1-1-1", ltv: 120 },
  { id: "c8", name: "Robert Brown", email: "rob.b@email.com", segment: "Potential Loyalists", totalOrders: 4, totalSpent: 345.70, lastOrderDate: "2026-02-22", rfmScore: "4-3-3", ltv: 650 },
];

const rfmLabels: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Medium", 4: "High", 5: "Very High" };

const CustomerSegments: React.FC = () => {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [segmentFilter, setSegmentFilter] = useState<string | undefined>();

  const totalCustomers = mockSegments.reduce((s, seg) => s + seg.customerCount, 0);
  const totalRevenue = mockSegments.reduce((s, seg) => s + seg.totalRevenue, 0);

  const filteredCustomers = mockCustomers.filter((c) => {
    if (selectedSegment) return c.segment === selectedSegment.name;
    if (segmentFilter) return c.segment === segmentFilter;
    return true;
  });

  const handleCreateSegment = () => {
    form.validateFields().then((values) => {
      message.success(`Custom segment "${values.name}" created`);
      setCreateModalOpen(false);
      form.resetFields();
    });
  };

  const customerColumns = [
    {
      title: "Customer",
      key: "customer",
      render: (_: unknown, record: CustomerInSegment) => (
        <Space>
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: "#0f6fa815", color: "#0f6fa8" }}>
            {record.name.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Segment",
      dataIndex: "segment",
      key: "segment",
      render: (seg: string) => {
        const segDef = mockSegments.find((s) => s.name === seg);
        return segDef ? (
          <Tag color={segDef.color} style={{ borderRadius: 6 }}>{seg}</Tag>
        ) : (
          <Tag>{seg}</Tag>
        );
      },
    },
    {
      title: "Orders",
      dataIndex: "totalOrders",
      key: "totalOrders",
      sorter: (a: CustomerInSegment, b: CustomerInSegment) => a.totalOrders - b.totalOrders,
    },
    {
      title: "Total Spent",
      dataIndex: "totalSpent",
      key: "totalSpent",
      render: (v: number) => <Text strong>{formatCurrency(v)}</Text>,
      sorter: (a: CustomerInSegment, b: CustomerInSegment) => a.totalSpent - b.totalSpent,
    },
    {
      title: "RFM Score",
      dataIndex: "rfmScore",
      key: "rfmScore",
      render: (score: string) => <Tag style={{ fontFamily: "monospace", borderRadius: 4 }}>{score}</Tag>,
    },
    {
      title: "LTV",
      dataIndex: "ltv",
      key: "ltv",
      render: (v: number) => <Text style={{ color: "#0f6fa8", fontWeight: 500 }}>{formatCurrency(v)}</Text>,
      sorter: (a: CustomerInSegment, b: CustomerInSegment) => a.ltv - b.ltv,
    },
    {
      title: "Last Order",
      dataIndex: "lastOrderDate",
      key: "lastOrderDate",
      sorter: (a: CustomerInSegment, b: CustomerInSegment) => new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime(),
    },
    {
      title: "",
      key: "action",
      render: () => (
        <Button size="small" type="text" icon={<MailOutlined />} onClick={() => message.info("Email campaign initiated")}>
          Email
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customer Segmentation"
        subtitle="Analyze customer behavior with RFM scoring and targeted segmentation"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create Segment
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic title="Total Customers" value={totalCustomers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic title="Total Revenue" value={totalRevenue} precision={0} prefix="$" />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic title="Segments" value={mockSegments.length} prefix={<FilterOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic title="Avg LTV" value={totalRevenue / totalCustomers} precision={2} prefix="$" />
          </Card>
        </Col>
      </Row>

      {/* RFM Matrix */}
      <Card title="RFM Analysis - Customer Segments" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {mockSegments.map((seg) => (
            <Col xs={24} sm={12} md={8} key={seg.id}>
              <Card
                size="small"
                hoverable
                style={{
                  borderLeft: `4px solid ${seg.color}`,
                  backgroundColor: selectedSegment?.id === seg.id ? seg.bgColor : undefined,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedSegment(selectedSegment?.id === seg.id ? null : seg)}
              >
                <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                  <Space style={{ justifyContent: "space-between", width: "100%" }}>
                    <Space>
                      <Avatar
                        size={36}
                        style={{ backgroundColor: seg.bgColor, color: seg.color }}
                        icon={seg.icon}
                      />
                      <div>
                        <Text strong style={{ fontSize: 14 }}>{seg.name}</Text>
                        <div>
                          <Badge
                            count={
                              <span style={{
                                fontSize: 11,
                                color: seg.trend === "up" ? "#15803d" : seg.trend === "down" ? "#dc2626" : "#8c8c8c",
                              }}>
                                {seg.trend === "up" ? <RiseOutlined /> : seg.trend === "down" ? <FallOutlined /> : null}
                                {" "}{seg.trendValue}%
                              </span>
                            }
                          />
                        </div>
                      </div>
                    </Space>
                    <Text strong style={{ fontSize: 20, color: seg.color }}>{formatNumber(seg.customerCount)}</Text>
                  </Space>

                  <Text type="secondary" style={{ fontSize: 12 }}>{seg.description}</Text>

                  <Row gutter={8}>
                    <Col span={8}>
                      <div style={{ textAlign: "center" }}>
                        <Text type="secondary" style={{ fontSize: 10, display: "block" }}>R</Text>
                        <Progress
                          type="circle"
                          percent={seg.rfmScores.recency * 20}
                          width={32}
                          format={() => seg.rfmScores.recency}
                          strokeColor={seg.color}
                        />
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: "center" }}>
                        <Text type="secondary" style={{ fontSize: 10, display: "block" }}>F</Text>
                        <Progress
                          type="circle"
                          percent={seg.rfmScores.frequency * 20}
                          width={32}
                          format={() => seg.rfmScores.frequency}
                          strokeColor={seg.color}
                        />
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: "center" }}>
                        <Text type="secondary" style={{ fontSize: 10, display: "block" }}>M</Text>
                        <Progress
                          type="circle"
                          percent={seg.rfmScores.monetary * 20}
                          width={32}
                          format={() => seg.rfmScores.monetary}
                          strokeColor={seg.color}
                        />
                      </div>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "4px 0" }} />

                  <Row gutter={8}>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 10 }}>AOV</Text>
                      <div><Text strong style={{ fontSize: 12 }}>{formatCurrency(seg.avgOrderValue)}</Text></div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 10 }}>Revenue</Text>
                      <div><Text strong style={{ fontSize: 12 }}>${(seg.totalRevenue / 1000).toFixed(0)}k</Text></div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 10 }}>Retention</Text>
                      <div><Text strong style={{ fontSize: 12, color: seg.retentionRate > 50 ? "#15803d" : "#d97706" }}>{seg.retentionRate}%</Text></div>
                    </Col>
                  </Row>

                  <div>
                    <Text type="secondary" style={{ fontSize: 10, display: "block", marginBottom: 4 }}>Suggested Actions:</Text>
                    {seg.suggestedActions.slice(0, 2).map((action, i) => (
                      <Tag key={i} style={{ fontSize: 10, marginBottom: 2, borderRadius: 4 }}>{action}</Tag>
                    ))}
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Customer Table */}
      <Card
        title={
          <Space>
            <span>Customers</span>
            {selectedSegment && (
              <Tag color={selectedSegment.color} closable onClose={() => setSelectedSegment(null)} style={{ borderRadius: 6 }}>
                {selectedSegment.name}
              </Tag>
            )}
          </Space>
        }
        extra={
          !selectedSegment && (
            <Select
              placeholder="Filter by segment"
              allowClear
              value={segmentFilter}
              onChange={setSegmentFilter}
              style={{ width: 200 }}
              options={mockSegments.map((s) => ({ label: s.name, value: s.name }))}
            />
          )
        }
      >
        <Table
          dataSource={filteredCustomers}
          columns={customerColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, showTotal: (total) => `${total} customers` }}
        />
      </Card>

      <Modal
        title="Create Custom Segment"
        open={createModalOpen}
        onOk={handleCreateSegment}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        okText="Create Segment"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Segment Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., High-Value Repeat Buyers" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Describe this customer segment..." />
          </Form.Item>
          <Divider>Segment Rules</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="minRecency" label="Min Recency Score (1-5)">
                <InputNumber min={1} max={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="minFrequency" label="Min Frequency Score (1-5)">
                <InputNumber min={1} max={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="minMonetary" label="Min Monetary Score (1-5)">
                <InputNumber min={1} max={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="minOrders" label="Min Total Orders">
                <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="minSpent" label="Min Total Spent ($)">
                <InputNumber min={0} prefix="$" style={{ width: "100%" }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="lastOrderWithin" label="Last Order Within">
            <Select
              placeholder="Any time"
              allowClear
              options={[
                { label: "Last 7 days", value: "7d" },
                { label: "Last 30 days", value: "30d" },
                { label: "Last 90 days", value: "90d" },
                { label: "Last 6 months", value: "6m" },
                { label: "Last year", value: "1y" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomerSegments;
