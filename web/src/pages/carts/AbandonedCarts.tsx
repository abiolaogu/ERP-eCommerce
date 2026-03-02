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
  Tooltip,
  message,
  Badge,
  Divider,
  Select,
  List,
  Avatar,
  Progress,
} from "antd";
import {
  SearchOutlined,
  ShoppingCartOutlined,
  MailOutlined,
  MessageOutlined,
  GiftOutlined,
  UserOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  EyeOutlined,
  PercentageOutlined,
  ReconciliationOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber, formatRelativeTime, formatDate } from "@/utils/formatters";

const { Text } = Typography;

interface AbandonedCart {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: { name: string; quantity: number; price: number; image?: string }[];
  cartValue: number;
  abandonedAt: string;
  recoveryStatus: "not_attempted" | "email_sent" | "sms_sent" | "discount_offered" | "recovered" | "lost";
  lastAction?: string;
  lastActionAt?: string;
  emailOpened: boolean;
  discountCode?: string;
}

const mockCarts: AbandonedCart[] = [
  {
    id: "ac1", customerId: "c1", customerName: "Sarah Johnson", customerEmail: "sarah.j@email.com",
    items: [{ name: "Wireless Headphones Pro", quantity: 1, price: 149.99 }, { name: "Phone Case Premium", quantity: 2, price: 24.99 }],
    cartValue: 199.97, abandonedAt: "2026-02-28T08:30:00Z", recoveryStatus: "not_attempted", emailOpened: false,
  },
  {
    id: "ac2", customerId: "c2", customerName: "Michael Chen", customerEmail: "m.chen@email.com",
    items: [{ name: "Smart Watch Series 5", quantity: 1, price: 299.99 }],
    cartValue: 299.99, abandonedAt: "2026-02-28T06:15:00Z", recoveryStatus: "email_sent", lastAction: "Recovery email sent", lastActionAt: "2026-02-28T07:15:00Z", emailOpened: true,
  },
  {
    id: "ac3", customerId: "c3", customerName: "Emily Davis", customerEmail: "emily.d@email.com",
    items: [{ name: "Running Shoes Ultra", quantity: 1, price: 119.99 }, { name: "Running Socks Pack", quantity: 3, price: 12.99 }],
    cartValue: 158.96, abandonedAt: "2026-02-27T22:00:00Z", recoveryStatus: "discount_offered", lastAction: "10% discount sent", lastActionAt: "2026-02-28T00:00:00Z", emailOpened: true, discountCode: "RECOVER10",
  },
  {
    id: "ac4", customerId: "c4", customerName: "James Wilson", customerEmail: "james.w@email.com",
    items: [{ name: "Organic Cotton T-Shirt", quantity: 4, price: 29.99 }, { name: "Leather Belt", quantity: 1, price: 39.99 }],
    cartValue: 159.95, abandonedAt: "2026-02-27T18:30:00Z", recoveryStatus: "recovered", lastAction: "Customer completed purchase", lastActionAt: "2026-02-28T09:00:00Z", emailOpened: true,
  },
  {
    id: "ac5", customerId: "c5", customerName: "Anna Martinez", customerEmail: "anna.m@email.com",
    items: [{ name: "Yoga Mat Professional", quantity: 1, price: 39.99 }, { name: "Yoga Block Set", quantity: 1, price: 19.99 }],
    cartValue: 59.98, abandonedAt: "2026-02-27T14:00:00Z", recoveryStatus: "sms_sent", lastAction: "SMS reminder sent", lastActionAt: "2026-02-27T16:00:00Z", emailOpened: false,
  },
  {
    id: "ac6", customerId: "c6", customerName: "David Kim", customerEmail: "david.k@email.com",
    items: [{ name: "Portable Bluetooth Speaker", quantity: 2, price: 59.99 }],
    cartValue: 119.98, abandonedAt: "2026-02-26T20:00:00Z", recoveryStatus: "lost", lastAction: "No response after 3 attempts", lastActionAt: "2026-02-28T08:00:00Z", emailOpened: false,
  },
  {
    id: "ac7", customerId: "c7", customerName: "Lisa Taylor", customerEmail: "lisa.t@email.com",
    items: [{ name: "Ceramic Coffee Mug Set", quantity: 2, price: 24.99 }, { name: "Tea Sampler Pack", quantity: 1, price: 34.99 }],
    cartValue: 84.97, abandonedAt: "2026-02-28T10:00:00Z", recoveryStatus: "not_attempted", emailOpened: false,
  },
  {
    id: "ac8", customerId: "c8", customerName: "Robert Brown", customerEmail: "rob.b@email.com",
    items: [{ name: "Noise-Cancelling Earbuds", quantity: 1, price: 89.99 }, { name: "Carrying Case", quantity: 1, price: 14.99 }],
    cartValue: 104.98, abandonedAt: "2026-02-27T12:45:00Z", recoveryStatus: "recovered", lastAction: "Customer recovered after email", lastActionAt: "2026-02-27T18:00:00Z", emailOpened: true,
  },
  {
    id: "ac9", customerId: "c9", customerName: "Karen White", customerEmail: "karen.w@email.com",
    items: [{ name: "Stainless Steel Water Bottle", quantity: 3, price: 24.99 }],
    cartValue: 74.97, abandonedAt: "2026-02-26T09:00:00Z", recoveryStatus: "email_sent", lastAction: "Recovery email sent", lastActionAt: "2026-02-26T11:00:00Z", emailOpened: false,
  },
  {
    id: "ac10", customerId: "c10", customerName: "Tom Anderson", customerEmail: "tom.a@email.com",
    items: [{ name: "Smart Watch Series 5", quantity: 1, price: 299.99 }, { name: "Watch Band Premium", quantity: 2, price: 29.99 }],
    cartValue: 359.97, abandonedAt: "2026-02-28T07:00:00Z", recoveryStatus: "not_attempted", emailOpened: false,
  },
];

const AbandonedCarts: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [carts, setCarts] = useState(mockCarts);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AbandonedCart | null>(null);

  const stats = useMemo(() => {
    const total = carts.length;
    const totalValue = carts.reduce((s, c) => s + c.cartValue, 0);
    const recovered = carts.filter((c) => c.recoveryStatus === "recovered").length;
    const recoveredValue = carts.filter((c) => c.recoveryStatus === "recovered").reduce((s, c) => s + c.cartValue, 0);
    const recoveryRate = total > 0 ? (recovered / total) * 100 : 0;
    const notAttempted = carts.filter((c) => c.recoveryStatus === "not_attempted").length;
    const avgCartValue = total > 0 ? totalValue / total : 0;
    return { total, totalValue, recovered, recoveredValue, recoveryRate, notAttempted, avgCartValue };
  }, [carts]);

  const filteredCarts = carts.filter((cart) => {
    const matchesSearch = !searchText || cart.customerName.toLowerCase().includes(searchText.toLowerCase()) || cart.customerEmail.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !statusFilter || cart.recoveryStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSendEmail = (cartId: string) => {
    setCarts((prev) =>
      prev.map((c) =>
        c.id === cartId ? { ...c, recoveryStatus: "email_sent" as const, lastAction: "Recovery email sent", lastActionAt: new Date().toISOString() } : c
      )
    );
    message.success("Recovery email sent");
  };

  const handleSendSMS = (cartId: string) => {
    setCarts((prev) =>
      prev.map((c) =>
        c.id === cartId ? { ...c, recoveryStatus: "sms_sent" as const, lastAction: "SMS reminder sent", lastActionAt: new Date().toISOString() } : c
      )
    );
    message.success("SMS reminder sent");
  };

  const handleOfferDiscount = (cartId: string) => {
    const code = `SAVE${Math.floor(Math.random() * 20 + 5)}`;
    setCarts((prev) =>
      prev.map((c) =>
        c.id === cartId ? { ...c, recoveryStatus: "discount_offered" as const, lastAction: `Discount ${code} sent`, lastActionAt: new Date().toISOString(), discountCode: code } : c
      )
    );
    message.success(`Discount code ${code} sent to customer`);
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    not_attempted: { color: "default", icon: <ClockCircleOutlined />, label: "Not Attempted" },
    email_sent: { color: "processing", icon: <MailOutlined />, label: "Email Sent" },
    sms_sent: { color: "processing", icon: <MessageOutlined />, label: "SMS Sent" },
    discount_offered: { color: "warning", icon: <GiftOutlined />, label: "Discount Offered" },
    recovered: { color: "success", icon: <CheckCircleOutlined />, label: "Recovered" },
    lost: { color: "error", icon: <WarningOutlined />, label: "Lost" },
  };

  const columns = [
    {
      title: "Customer",
      key: "customer",
      width: 200,
      render: (_: unknown, record: AbandonedCart) => (
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
      title: "Items",
      key: "items",
      width: 100,
      render: (_: unknown, record: AbandonedCart) => (
        <Badge count={record.items.reduce((s, i) => s + i.quantity, 0)} style={{ backgroundColor: "#0f6fa8" }}>
          <ShoppingCartOutlined style={{ fontSize: 20, color: "#8c8c8c" }} />
        </Badge>
      ),
    },
    {
      title: "Cart Value",
      dataIndex: "cartValue",
      key: "cartValue",
      width: 130,
      render: (val: number) => (
        <Text strong style={{ fontSize: 14, color: "#0f6fa8" }}>
          {formatCurrency(val)}
        </Text>
      ),
      sorter: (a: AbandonedCart, b: AbandonedCart) => a.cartValue - b.cartValue,
    },
    {
      title: "Abandoned",
      dataIndex: "abandonedAt",
      key: "abandonedAt",
      width: 140,
      render: (date: string) => (
        <Tooltip title={formatDate(date)}>
          <Space orientation="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{formatRelativeTime(date)}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </Space>
        </Tooltip>
      ),
      sorter: (a: AbandonedCart, b: AbandonedCart) => new Date(a.abandonedAt).getTime() - new Date(b.abandonedAt).getTime(),
    },
    {
      title: "Recovery Status",
      dataIndex: "recoveryStatus",
      key: "recoveryStatus",
      width: 160,
      render: (status: string) => {
        const c = statusConfig[status] || statusConfig.not_attempted;
        return <Tag color={c.color} icon={c.icon} style={{ borderRadius: 6 }}>{c.label}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_: unknown, record: AbandonedCart) => {
        if (record.recoveryStatus === "recovered" || record.recoveryStatus === "lost") {
          return (
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={() => { setDetailTarget(record); setDetailModalOpen(true); }}
            >
              View
            </Button>
          );
        }
        return (
          <Space size={4}>
            <Tooltip title="Send Email">
              <Button size="small" icon={<MailOutlined />} onClick={() => handleSendEmail(record.id)} />
            </Tooltip>
            <Tooltip title="Send SMS">
              <Button size="small" icon={<MessageOutlined />} onClick={() => handleSendSMS(record.id)} />
            </Tooltip>
            <Tooltip title="Offer Discount">
              <Button size="small" icon={<GiftOutlined />} onClick={() => handleOfferDiscount(record.id)} />
            </Tooltip>
            <Tooltip title="View Details">
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                onClick={() => { setDetailTarget(record); setDetailModalOpen(true); }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Abandoned Cart Recovery"
        subtitle="Recover lost revenue by re-engaging customers who left items in their cart"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Abandoned Carts" value={stats.total} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Value at Risk" value={stats.totalValue} precision={2} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Recovered" value={stats.recovered} valueStyle={{ color: "#15803d" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Recovered Value" value={stats.recoveredValue} precision={2} valueStyle={{ color: "#15803d" }} prefix="$" />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Recovery Rate"
              value={stats.recoveryRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: stats.recoveryRate >= 20 ? "#15803d" : "#d97706" }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Avg Cart Value" value={stats.avgCartValue} precision={2} prefix="$" />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Input
            placeholder="Search by customer name or email..."
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
            style={{ width: 200 }}
            options={Object.entries(statusConfig).map(([key, val]) => ({ label: val.label, value: key }))}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => {
              const notAttempted = carts.filter((c) => c.recoveryStatus === "not_attempted");
              notAttempted.forEach((c) => handleSendEmail(c.id));
              message.success(`Sent recovery emails to ${notAttempted.length} customers`);
            }}
          >
            Send All Pending
          </Button>
        </div>

        <Table
          dataSource={filteredCarts}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} abandoned carts` }}
        />
      </Card>

      <Modal
        title="Cart Details"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={
          detailTarget && detailTarget.recoveryStatus !== "recovered" && detailTarget.recoveryStatus !== "lost" ? (
            <Space>
              <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
              <Button icon={<MailOutlined />} onClick={() => { handleSendEmail(detailTarget.id); setDetailModalOpen(false); }}>
                Send Email
              </Button>
              <Button icon={<MessageOutlined />} onClick={() => { handleSendSMS(detailTarget.id); setDetailModalOpen(false); }}>
                Send SMS
              </Button>
              <Button type="primary" icon={<GiftOutlined />} onClick={() => { handleOfferDiscount(detailTarget.id); setDetailModalOpen(false); }}>
                Offer Discount
              </Button>
            </Space>
          ) : null
        }
        width={560}
      >
        {detailTarget && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Space>
              <Avatar size={48} icon={<UserOutlined />} style={{ backgroundColor: "#0f6fa815", color: "#0f6fa8" }}>
                {detailTarget.customerName.charAt(0)}
              </Avatar>
              <div>
                <Text strong style={{ fontSize: 15 }}>{detailTarget.customerName}</Text>
                <div><Text type="secondary">{detailTarget.customerEmail}</Text></div>
              </div>
            </Space>

            <Card size="small" title="Cart Items">
              <List
                size="small"
                dataSource={detailTarget.items}
                renderItem={(item) => (
                  <List.Item extra={<Text strong>{formatCurrency(item.price * item.quantity)}</Text>}>
                    <List.Item.Meta
                      title={item.name}
                      description={`Qty: ${item.quantity} x ${formatCurrency(item.price)}`}
                    />
                  </List.Item>
                )}
              />
              <Divider style={{ margin: "8px 0" }} />
              <div style={{ textAlign: "right" }}>
                <Text strong style={{ fontSize: 16 }}>Total: {formatCurrency(detailTarget.cartValue)}</Text>
              </div>
            </Card>

            <Space split={<Divider type="vertical" />}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Abandoned: {formatRelativeTime(detailTarget.abandonedAt)}
              </Text>
              {detailTarget.lastAction && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Last action: {detailTarget.lastAction}
                </Text>
              )}
            </Space>

            {detailTarget.discountCode && (
              <Tag color="orange" style={{ fontSize: 13, padding: "4px 12px", borderRadius: 6 }}>
                <GiftOutlined /> Discount Code: <Text strong copyable>{detailTarget.discountCode}</Text>
              </Tag>
            )}

            {detailTarget.emailOpened && (
              <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 6 }}>
                Email Opened
              </Tag>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AbandonedCarts;
