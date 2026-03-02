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
  Avatar,
  Badge,
  Timeline,
  InputNumber,
  Divider,
  List,
  Progress,
} from "antd";
import {
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CarOutlined,
  InboxOutlined,
  SendOutlined,
  PrinterOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  CalculatorOutlined,
  GlobalOutlined,
  GiftOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber, formatDate, formatRelativeTime } from "@/utils/formatters";

const { Text } = Typography;

interface FulfillmentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: number;
  shippingAddress: string;
  carrier?: string;
  trackingNumber?: string;
  status: "pending" | "processing" | "shipped" | "in_transit" | "delivered" | "failed";
  estimatedDelivery?: string;
  shippingMethod: string;
  weight: number;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
}

interface ShippingCarrier {
  id: string;
  name: string;
  logo: string;
  status: "active" | "inactive";
  servicesAvailable: string[];
  avgDeliveryDays: number;
  onTimeRate: number;
  shipmentsThisMonth: number;
  costPerShipment: number;
}

const mockOrders: FulfillmentOrder[] = [
  { id: "fo-1", orderNumber: "ORD-2401", customerName: "Sarah Johnson", items: 3, shippingAddress: "123 Main St, New York, NY 10001", status: "pending", shippingMethod: "Standard", weight: 2.5, createdAt: "2026-02-28T09:00:00Z" },
  { id: "fo-2", orderNumber: "ORD-2400", customerName: "Michael Chen", items: 1, shippingAddress: "456 Oak Ave, San Francisco, CA 94102", carrier: "FedEx", status: "processing", shippingMethod: "Express", weight: 0.8, createdAt: "2026-02-28T07:30:00Z" },
  { id: "fo-3", orderNumber: "ORD-2399", customerName: "Emily Davis", items: 2, shippingAddress: "789 Pine Rd, Chicago, IL 60601", carrier: "DHL", trackingNumber: "DHL7891234567", status: "shipped", shippingMethod: "Express", weight: 1.2, createdAt: "2026-02-27T14:00:00Z", shippedAt: "2026-02-28T06:00:00Z", estimatedDelivery: "2026-03-02" },
  { id: "fo-4", orderNumber: "ORD-2398", customerName: "James Wilson", items: 5, shippingAddress: "321 Elm Blvd, Houston, TX 77001", carrier: "FedEx", trackingNumber: "FDX4561234567", status: "in_transit", shippingMethod: "Standard", weight: 4.1, createdAt: "2026-02-26T10:00:00Z", shippedAt: "2026-02-27T08:00:00Z", estimatedDelivery: "2026-03-03" },
  { id: "fo-5", orderNumber: "ORD-2397", customerName: "Anna Martinez", items: 1, shippingAddress: "555 Maple Dr, Miami, FL 33101", carrier: "DHL", trackingNumber: "DHL5551234567", status: "delivered", shippingMethod: "Express", weight: 0.5, createdAt: "2026-02-24T11:00:00Z", shippedAt: "2026-02-25T07:00:00Z", deliveredAt: "2026-02-27T14:30:00Z" },
  { id: "fo-6", orderNumber: "ORD-2396", customerName: "David Kim", items: 2, shippingAddress: "888 Cedar Ln, Seattle, WA 98101", carrier: "Local Courier", trackingNumber: "LC8881234567", status: "delivered", shippingMethod: "Same Day", weight: 1.8, createdAt: "2026-02-27T08:00:00Z", shippedAt: "2026-02-27T10:00:00Z", deliveredAt: "2026-02-27T17:00:00Z" },
  { id: "fo-7", orderNumber: "ORD-2395", customerName: "Lisa Taylor", items: 4, shippingAddress: "444 Birch Way, Denver, CO 80201", status: "pending", shippingMethod: "Economy", weight: 3.2, createdAt: "2026-02-28T10:15:00Z" },
  { id: "fo-8", orderNumber: "ORD-2394", customerName: "Robert Brown", items: 1, shippingAddress: "222 Spruce Ct, Boston, MA 02101", carrier: "FedEx", trackingNumber: "FDX2221234567", status: "failed", shippingMethod: "Standard", weight: 0.6, createdAt: "2026-02-25T09:00:00Z", shippedAt: "2026-02-26T07:00:00Z" },
  { id: "fo-9", orderNumber: "ORD-2393", customerName: "Karen White", items: 2, shippingAddress: "666 Walnut Ave, Portland, OR 97201", carrier: "DHL", status: "processing", shippingMethod: "Standard", weight: 2.0, createdAt: "2026-02-28T06:00:00Z" },
];

const mockCarriers: ShippingCarrier[] = [
  { id: "car-1", name: "DHL Express", logo: "DHL", status: "active", servicesAvailable: ["Express", "Standard", "Economy", "International"], avgDeliveryDays: 3.2, onTimeRate: 94.5, shipmentsThisMonth: 487, costPerShipment: 12.50 },
  { id: "car-2", name: "FedEx", logo: "FDX", status: "active", servicesAvailable: ["Overnight", "Express", "Ground", "Freight"], avgDeliveryDays: 2.8, onTimeRate: 96.1, shipmentsThisMonth: 623, costPerShipment: 14.80 },
  { id: "car-3", name: "Local Courier", logo: "LC", status: "active", servicesAvailable: ["Same Day", "Next Day"], avgDeliveryDays: 0.5, onTimeRate: 98.2, shipmentsThisMonth: 156, costPerShipment: 8.50 },
  { id: "car-4", name: "USPS", logo: "USPS", status: "inactive", servicesAvailable: ["Priority Mail", "First Class", "Media Mail"], avgDeliveryDays: 4.5, onTimeRate: 88.3, shipmentsThisMonth: 0, costPerShipment: 7.20 },
];

const ShippingDashboard: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [orders, setOrders] = useState(mockOrders);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingTarget, setTrackingTarget] = useState<FulfillmentOrder | null>(null);
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [calcWeight, setCalcWeight] = useState(1);
  const [calcZone, setCalcZone] = useState("domestic");

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const processing = orders.filter((o) => o.status === "processing").length;
    const shipped = orders.filter((o) => o.status === "shipped" || o.status === "in_transit").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const failed = orders.filter((o) => o.status === "failed").length;
    const total = orders.length;
    return { pending, processing, shipped, delivered, failed, total };
  }, [orders]);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = !searchText || o.orderNumber.toLowerCase().includes(searchText.toLowerCase()) || o.customerName.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !statusFilter || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleProcessOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "processing" as const, carrier: "FedEx" } : o))
    );
    message.success("Order moved to processing");
  };

  const handleShipOrder = (orderId: string) => {
    const tracking = `TRK${Date.now().toString().slice(-10)}`;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: "shipped" as const, trackingNumber: tracking, shippedAt: new Date().toISOString(), estimatedDelivery: "2026-03-05" }
          : o
      )
    );
    message.success(`Shipped with tracking: ${tracking}`);
  };

  const handleGenerateLabel = (orderId: string) => {
    message.success("Shipping label generated and sent to printer");
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: "default", icon: <ClockCircleOutlined />, label: "Pending" },
    processing: { color: "processing", icon: <InboxOutlined />, label: "Processing" },
    shipped: { color: "blue", icon: <SendOutlined />, label: "Shipped" },
    in_transit: { color: "cyan", icon: <CarOutlined />, label: "In Transit" },
    delivered: { color: "success", icon: <CheckCircleOutlined />, label: "Delivered" },
    failed: { color: "error", icon: <ClockCircleOutlined />, label: "Failed" },
  };

  const calcRates = useMemo(() => {
    const baseRate = calcZone === "domestic" ? 5.99 : calcZone === "regional" ? 9.99 : 19.99;
    const weightRate = calcWeight * (calcZone === "international" ? 4.5 : 2.5);
    return mockCarriers.filter((c) => c.status === "active").map((carrier) => ({
      carrier: carrier.name,
      standard: (baseRate + weightRate) * (carrier.costPerShipment / 10),
      express: (baseRate + weightRate) * (carrier.costPerShipment / 10) * 1.8,
      overnight: (baseRate + weightRate) * (carrier.costPerShipment / 10) * 3.2,
      days: carrier.avgDeliveryDays,
    }));
  }, [calcWeight, calcZone]);

  const columns = [
    {
      title: "Order",
      key: "order",
      width: 180,
      render: (_: unknown, record: FulfillmentOrder) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{record.orderNumber}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{record.customerName}</Text>
        </div>
      ),
    },
    {
      title: "Items",
      dataIndex: "items",
      key: "items",
      width: 70,
      render: (val: number) => <Badge count={val} style={{ backgroundColor: "#0f6fa8" }} />,
    },
    {
      title: "Destination",
      dataIndex: "shippingAddress",
      key: "shippingAddress",
      width: 220,
      render: (addr: string) => (
        <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: addr }}>
          <EnvironmentOutlined style={{ marginRight: 4, color: "#8c8c8c" }} />
          {addr}
        </Text>
      ),
    },
    {
      title: "Method",
      dataIndex: "shippingMethod",
      key: "shippingMethod",
      width: 100,
      render: (method: string) => (
        <Tag style={{ borderRadius: 6 }}>
          {method === "Express" ? <RocketOutlined /> : method === "Same Day" ? <ThunderboltOutlined /> : <CarOutlined />}
          {" "}{method}
        </Tag>
      ),
    },
    {
      title: "Carrier",
      dataIndex: "carrier",
      key: "carrier",
      width: 100,
      render: (carrier: string) => carrier ? <Text style={{ fontSize: 13 }}>{carrier}</Text> : <Text type="secondary">--</Text>,
    },
    {
      title: "Tracking",
      dataIndex: "trackingNumber",
      key: "trackingNumber",
      width: 150,
      render: (tracking: string, record: FulfillmentOrder) =>
        tracking ? (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: 12, fontFamily: "monospace" }}
            onClick={() => { setTrackingTarget(record); setTrackingModalOpen(true); }}
          >
            {tracking.substring(0, 15)}...
          </Button>
        ) : (
          <Text type="secondary">--</Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const c = statusConfig[status] || statusConfig.pending;
        return <Tag color={c.color} icon={c.icon} style={{ borderRadius: 6 }}>{c.label}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_: unknown, record: FulfillmentOrder) => (
        <Space size={4}>
          {record.status === "pending" && (
            <Button size="small" onClick={() => handleProcessOrder(record.id)}>
              Process
            </Button>
          )}
          {record.status === "processing" && (
            <>
              <Tooltip title="Generate Label">
                <Button size="small" icon={<PrinterOutlined />} onClick={() => handleGenerateLabel(record.id)} />
              </Tooltip>
              <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => handleShipOrder(record.id)}>
                Ship
              </Button>
            </>
          )}
          {(record.status === "shipped" || record.status === "in_transit") && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => { setTrackingTarget(record); setTrackingModalOpen(true); }}
            >
              Track
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Shipping & Fulfillment"
        subtitle="Process orders, manage carriers, and track deliveries"
        extra={
          <Button icon={<CalculatorOutlined />} onClick={() => setCalcModalOpen(true)}>
            Rate Calculator
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="To Ship" value={stats.pending} valueStyle={{ color: "#d97706" }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Processing" value={stats.processing} valueStyle={{ color: "#0f6fa8" }} prefix={<InboxOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Shipped" value={stats.shipped} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Delivered" value={stats.delivered} valueStyle={{ color: "#15803d" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Failed" value={stats.failed} valueStyle={{ color: "#dc2626" }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Orders" value={stats.total} prefix={<GiftOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        style={{ marginBottom: 16 }}
        items={[
          {
            key: "queue",
            label: <span><InboxOutlined /> Fulfillment Queue</span>,
            children: (
              <Card>
                <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Input
                    placeholder="Search by order or customer..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 280, borderRadius: 8 }}
                    allowClear
                  />
                  <Select
                    placeholder="Filter by status"
                    allowClear
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 180 }}
                    options={Object.entries(statusConfig).map(([key, val]) => ({ label: val.label, value: key }))}
                  />
                </div>
                <Table
                  dataSource={filteredOrders}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 10, showTotal: (total) => `${total} orders` }}
                />
              </Card>
            ),
          },
          {
            key: "carriers",
            label: <span><CarOutlined /> Carriers</span>,
            children: (
              <Row gutter={[16, 16]}>
                {mockCarriers.map((carrier) => (
                  <Col xs={24} sm={12} md={6} key={carrier.id}>
                    <Card
                      style={{ borderTop: `3px solid ${carrier.status === "active" ? "#15803d" : "#d9d9d9"}` }}
                    >
                      <Space orientation="vertical" style={{ width: "100%" }} size={12}>
                        <Space style={{ justifyContent: "space-between", width: "100%" }}>
                          <Space>
                            <Avatar size={40} style={{ backgroundColor: carrier.status === "active" ? "#0f6fa815" : "#f5f5f5", color: "#0f6fa8", fontWeight: 700 }}>
                              {carrier.logo}
                            </Avatar>
                            <div>
                              <Text strong style={{ fontSize: 14 }}>{carrier.name}</Text>
                              <div>
                                <Tag color={carrier.status === "active" ? "success" : "default"} style={{ borderRadius: 4, fontSize: 10 }}>
                                  {carrier.status === "active" ? "Active" : "Inactive"}
                                </Tag>
                              </div>
                            </div>
                          </Space>
                        </Space>

                        <Space wrap>
                          {carrier.servicesAvailable.map((svc) => (
                            <Tag key={svc} style={{ fontSize: 11, borderRadius: 4 }}>{svc}</Tag>
                          ))}
                        </Space>

                        <Divider style={{ margin: "4px 0" }} />

                        <Row gutter={8}>
                          <Col span={12}>
                            <Text type="secondary" style={{ fontSize: 10 }}>Avg Delivery</Text>
                            <div><Text strong>{carrier.avgDeliveryDays} days</Text></div>
                          </Col>
                          <Col span={12}>
                            <Text type="secondary" style={{ fontSize: 10 }}>On-Time Rate</Text>
                            <div>
                              <Text strong style={{ color: carrier.onTimeRate > 95 ? "#15803d" : carrier.onTimeRate > 90 ? "#d97706" : "#dc2626" }}>
                                {carrier.onTimeRate}%
                              </Text>
                            </div>
                          </Col>
                        </Row>
                        <Row gutter={8}>
                          <Col span={12}>
                            <Text type="secondary" style={{ fontSize: 10 }}>Shipments/Mo</Text>
                            <div><Text strong>{formatNumber(carrier.shipmentsThisMonth)}</Text></div>
                          </Col>
                          <Col span={12}>
                            <Text type="secondary" style={{ fontSize: 10 }}>Avg Cost</Text>
                            <div><Text strong>{formatCurrency(carrier.costPerShipment)}</Text></div>
                          </Col>
                        </Row>
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
        title="Delivery Tracking"
        open={trackingModalOpen}
        onCancel={() => setTrackingModalOpen(false)}
        footer={null}
        width={500}
      >
        {trackingTarget && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Card size="small" style={{ backgroundColor: "#fafafa" }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Order</Text>
                  <div><Text strong>{trackingTarget.orderNumber}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Tracking Number</Text>
                  <div><Text strong copyable style={{ fontFamily: "monospace" }}>{trackingTarget.trackingNumber}</Text></div>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Carrier</Text>
                  <div><Text strong>{trackingTarget.carrier}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Est. Delivery</Text>
                  <div><Text strong>{trackingTarget.estimatedDelivery ? formatDate(trackingTarget.estimatedDelivery) : "TBD"}</Text></div>
                </Col>
              </Row>
            </Card>

            <Timeline
              items={[
                {
                  color: "green",
                  children: (
                    <div>
                      <Text strong>Order Placed</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{formatDate(trackingTarget.createdAt)}</Text></div>
                    </div>
                  ),
                },
                ...(trackingTarget.shippedAt
                  ? [{
                      color: "blue" as const,
                      children: (
                        <div>
                          <Text strong>Shipped</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>{formatDate(trackingTarget.shippedAt)}</Text></div>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>Package picked up by {trackingTarget.carrier}</Text></div>
                        </div>
                      ),
                    }]
                  : []),
                ...(trackingTarget.status === "in_transit"
                  ? [{
                      color: "blue" as const,
                      dot: <CarOutlined />,
                      children: (
                        <div>
                          <Text strong>In Transit</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>Package is on the way to destination</Text></div>
                        </div>
                      ),
                    }]
                  : []),
                ...(trackingTarget.deliveredAt
                  ? [{
                      color: "green" as const,
                      dot: <CheckCircleOutlined />,
                      children: (
                        <div>
                          <Text strong>Delivered</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>{formatDate(trackingTarget.deliveredAt)}</Text></div>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>Package delivered to {trackingTarget.shippingAddress}</Text></div>
                        </div>
                      ),
                    }]
                  : [{
                      color: "gray" as const,
                      children: (
                        <div>
                          <Text type="secondary">Delivery</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>Est. {trackingTarget.estimatedDelivery ? formatDate(trackingTarget.estimatedDelivery) : "TBD"}</Text></div>
                        </div>
                      ),
                    }]),
              ]}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title="Shipping Rate Calculator"
        open={calcModalOpen}
        onCancel={() => setCalcModalOpen(false)}
        footer={null}
        width={600}
      >
        <Space orientation="vertical" style={{ width: "100%" }} size={16}>
          <Row gutter={16}>
            <Col span={12}>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Package Weight (kg)</Text>
              <InputNumber value={calcWeight} onChange={(v) => setCalcWeight(v || 1)} min={0.1} max={50} step={0.1} style={{ width: "100%" }} />
            </Col>
            <Col span={12}>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Shipping Zone</Text>
              <Select
                value={calcZone}
                onChange={setCalcZone}
                style={{ width: "100%" }}
                options={[
                  { label: "Domestic", value: "domestic" },
                  { label: "Regional (Neighboring)", value: "regional" },
                  { label: "International", value: "international" },
                ]}
              />
            </Col>
          </Row>

          <Table
            dataSource={calcRates}
            rowKey="carrier"
            size="small"
            pagination={false}
            columns={[
              { title: "Carrier", dataIndex: "carrier", key: "carrier", render: (v: string) => <Text strong>{v}</Text> },
              { title: "Standard", dataIndex: "standard", key: "standard", render: (v: number) => formatCurrency(v) },
              { title: "Express", dataIndex: "express", key: "express", render: (v: number) => formatCurrency(v) },
              { title: "Overnight", dataIndex: "overnight", key: "overnight", render: (v: number) => formatCurrency(v) },
              { title: "Est. Days", dataIndex: "days", key: "days", render: (v: number) => `${v} days` },
            ]}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default ShippingDashboard;
