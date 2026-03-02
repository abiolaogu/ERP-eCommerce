import React, { useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  InputNumber,
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
  Divider,
  List,
  Radio,
  Form,
  Progress,
  Descriptions,
} from "antd";
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  RollbackOutlined,
  DollarOutlined,
  EyeOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  WalletOutlined,
  BarChartOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber, formatDate, formatRelativeTime } from "@/utils/formatters";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ReturnRequest {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: { name: string; quantity: number; price: number; reason: string }[];
  totalAmount: number;
  reason: string;
  reasonDetail?: string;
  status: "requested" | "approved" | "received" | "refunded" | "rejected";
  refundType?: "full" | "partial" | "store_credit";
  refundAmount?: number;
  requestedDate: string;
  processedDate?: string;
  notes?: string;
  images?: string[];
}

interface ReturnReasonStat {
  reason: string;
  count: number;
  percentage: number;
  color: string;
}

const mockReturns: ReturnRequest[] = [
  { id: "ret-1", orderNumber: "ORD-2380", customerId: "c1", customerName: "Sarah Johnson", customerEmail: "sarah.j@email.com", items: [{ name: "Wireless Headphones Pro", quantity: 1, price: 149.99, reason: "Defective product" }], totalAmount: 149.99, reason: "Defective product", reasonDetail: "Left earphone stopped working after 2 weeks of normal use.", status: "requested", requestedDate: "2026-02-28T09:00:00Z" },
  { id: "ret-2", orderNumber: "ORD-2375", customerId: "c2", customerName: "Michael Chen", customerEmail: "m.chen@email.com", items: [{ name: "Organic Cotton T-Shirt", quantity: 2, price: 29.99, reason: "Wrong size" }], totalAmount: 59.98, reason: "Wrong size", reasonDetail: "Ordered L but received M. Both shirts are too small.", status: "approved", requestedDate: "2026-02-27T14:00:00Z", processedDate: "2026-02-28T08:00:00Z", refundType: "full", refundAmount: 59.98 },
  { id: "ret-3", orderNumber: "ORD-2370", customerId: "c3", customerName: "Emily Davis", customerEmail: "emily.d@email.com", items: [{ name: "Smart Watch Series 5", quantity: 1, price: 299.99, reason: "Not as described" }], totalAmount: 299.99, reason: "Not as described", reasonDetail: "The watch does not have the GPS feature that was advertised on the product page.", status: "requested", requestedDate: "2026-02-28T10:30:00Z" },
  { id: "ret-4", orderNumber: "ORD-2365", customerId: "c4", customerName: "James Wilson", customerEmail: "james.w@email.com", items: [{ name: "Running Shoes Ultra", quantity: 1, price: 119.99, reason: "Changed mind" }], totalAmount: 119.99, reason: "Changed mind", status: "received", requestedDate: "2026-02-25T11:00:00Z", processedDate: "2026-02-26T09:00:00Z", refundType: "store_credit", refundAmount: 119.99 },
  { id: "ret-5", orderNumber: "ORD-2360", customerId: "c5", customerName: "Anna Martinez", customerEmail: "anna.m@email.com", items: [{ name: "Yoga Mat Professional", quantity: 1, price: 39.99, reason: "Damaged in shipping" }, { name: "Yoga Block Set", quantity: 1, price: 19.99, reason: "Damaged in shipping" }], totalAmount: 59.98, reason: "Damaged in shipping", reasonDetail: "Package arrived torn open. Both items had visible damage.", status: "refunded", requestedDate: "2026-02-22T08:00:00Z", processedDate: "2026-02-24T10:00:00Z", refundType: "full", refundAmount: 59.98 },
  { id: "ret-6", orderNumber: "ORD-2355", customerId: "c6", customerName: "David Kim", customerEmail: "david.k@email.com", items: [{ name: "Portable Bluetooth Speaker", quantity: 1, price: 59.99, reason: "Better price found" }], totalAmount: 59.99, reason: "Better price found", status: "rejected", requestedDate: "2026-02-20T16:00:00Z", processedDate: "2026-02-21T09:00:00Z", notes: "Return policy does not cover price match claims after 7 days." },
  { id: "ret-7", orderNumber: "ORD-2350", customerId: "c7", customerName: "Lisa Taylor", customerEmail: "lisa.t@email.com", items: [{ name: "Ceramic Coffee Mug Set", quantity: 1, price: 24.99, reason: "Defective product" }], totalAmount: 24.99, reason: "Defective product", reasonDetail: "One mug in the set had a crack on the rim.", status: "refunded", requestedDate: "2026-02-18T12:00:00Z", processedDate: "2026-02-20T14:00:00Z", refundType: "full", refundAmount: 24.99 },
  { id: "ret-8", orderNumber: "ORD-2345", customerId: "c8", customerName: "Robert Brown", customerEmail: "rob.b@email.com", items: [{ name: "Leather Wallet Premium", quantity: 1, price: 49.99, reason: "Wrong item received" }], totalAmount: 49.99, reason: "Wrong item received", reasonDetail: "Received a black wallet instead of the brown one I ordered.", status: "approved", requestedDate: "2026-02-26T09:00:00Z", processedDate: "2026-02-27T08:00:00Z", refundType: "full", refundAmount: 49.99 },
];

const ReturnList: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("requests");
  const [returns, setReturns] = useState(mockReturns);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processTarget, setProcessTarget] = useState<ReturnRequest | null>(null);
  const [processAction, setProcessAction] = useState<"approve" | "reject">("approve");
  const [refundType, setRefundType] = useState<"full" | "partial" | "store_credit">("full");
  const [partialAmount, setPartialAmount] = useState(0);
  const [processNotes, setProcessNotes] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ReturnRequest | null>(null);

  const stats = useMemo(() => {
    const total = returns.length;
    const requested = returns.filter((r) => r.status === "requested").length;
    const approved = returns.filter((r) => r.status === "approved").length;
    const refunded = returns.filter((r) => r.status === "refunded").length;
    const rejected = returns.filter((r) => r.status === "rejected").length;
    const totalRefunded = returns.filter((r) => r.refundAmount).reduce((s, r) => s + (r.refundAmount || 0), 0);
    const returnRate = 4.2; // mock
    return { total, requested, approved, refunded, rejected, totalRefunded, returnRate };
  }, [returns]);

  const reasonStats = useMemo<ReturnReasonStat[]>(() => {
    const reasons: Record<string, number> = {};
    returns.forEach((r) => {
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    });
    const total = returns.length;
    const colors = ["#0f6fa8", "#dc2626", "#d97706", "#15803d", "#7c3aed", "#0891b2"];
    return Object.entries(reasons)
      .map(([reason, count], i) => ({
        reason,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [returns]);

  const filteredReturns = returns.filter((r) => {
    const matchesSearch = !searchText || r.orderNumber.toLowerCase().includes(searchText.toLowerCase()) || r.customerName.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenProcess = (record: ReturnRequest, action: "approve" | "reject") => {
    setProcessTarget(record);
    setProcessAction(action);
    setRefundType("full");
    setPartialAmount(record.totalAmount);
    setProcessNotes("");
    setProcessModalOpen(true);
  };

  const handleProcessReturn = () => {
    if (!processTarget) return;
    if (processAction === "approve") {
      const amt = refundType === "partial" ? partialAmount : processTarget.totalAmount;
      setReturns((prev) =>
        prev.map((r) =>
          r.id === processTarget.id
            ? { ...r, status: "approved" as const, processedDate: new Date().toISOString(), refundType, refundAmount: amt, notes: processNotes || undefined }
            : r
        )
      );
      message.success(`Return approved. ${refundType === "store_credit" ? "Store credit" : "Refund"} of ${formatCurrency(amt)} processed.`);
    } else {
      setReturns((prev) =>
        prev.map((r) =>
          r.id === processTarget.id
            ? { ...r, status: "rejected" as const, processedDate: new Date().toISOString(), notes: processNotes || undefined }
            : r
        )
      );
      message.success("Return request rejected");
    }
    setProcessModalOpen(false);
  };

  const handleMarkReceived = (id: string) => {
    setReturns((prev) => prev.map((r) => (r.id === id ? { ...r, status: "received" as const } : r)));
    message.success("Return marked as received");
  };

  const handleIssueRefund = (id: string) => {
    setReturns((prev) => prev.map((r) => (r.id === id ? { ...r, status: "refunded" as const } : r)));
    message.success("Refund issued successfully");
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    requested: { color: "processing", icon: <ClockCircleOutlined />, label: "Requested" },
    approved: { color: "blue", icon: <CheckCircleOutlined />, label: "Approved" },
    received: { color: "cyan", icon: <InboxOutlined />, label: "Received" },
    refunded: { color: "success", icon: <DollarOutlined />, label: "Refunded" },
    rejected: { color: "error", icon: <CloseCircleOutlined />, label: "Rejected" },
  };

  const columns = [
    {
      title: "Return ID",
      key: "id",
      width: 120,
      render: (_: unknown, record: ReturnRequest) => (
        <div>
          <Text strong style={{ fontSize: 12, fontFamily: "monospace" }}>{record.id.toUpperCase()}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{record.orderNumber}</Text>
        </div>
      ),
    },
    {
      title: "Customer",
      key: "customer",
      width: 180,
      render: (_: unknown, record: ReturnRequest) => (
        <Space>
          <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: "#0f6fa815", color: "#0f6fa8" }}>
            {record.customerName.charAt(0)}
          </Avatar>
          <Text style={{ fontSize: 13 }}>{record.customerName}</Text>
        </Space>
      ),
    },
    {
      title: "Items",
      key: "items",
      width: 220,
      render: (_: unknown, record: ReturnRequest) => (
        <Space orientation="vertical" size={0}>
          {record.items.slice(0, 2).map((item, i) => (
            <Text key={i} style={{ fontSize: 12 }}>
              {item.quantity}x {item.name}
            </Text>
          ))}
          {record.items.length > 2 && (
            <Text type="secondary" style={{ fontSize: 11 }}>+{record.items.length - 2} more</Text>
          )}
        </Space>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 160,
      render: (reason: string) => <Tag style={{ borderRadius: 6 }}>{reason}</Tag>,
    },
    {
      title: "Amount",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 110,
      render: (val: number) => <Text strong>{formatCurrency(val)}</Text>,
      sorter: (a: ReturnRequest, b: ReturnRequest) => a.totalAmount - b.totalAmount,
    },
    {
      title: "Requested",
      dataIndex: "requestedDate",
      key: "requestedDate",
      width: 120,
      render: (date: string) => (
        <Tooltip title={formatDate(date)}>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatRelativeTime(date)}</Text>
        </Tooltip>
      ),
      sorter: (a: ReturnRequest, b: ReturnRequest) => new Date(a.requestedDate).getTime() - new Date(b.requestedDate).getTime(),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const c = statusConfig[status] || statusConfig.requested;
        return <Tag color={c.color} icon={c.icon} style={{ borderRadius: 6 }}>{c.label}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_: unknown, record: ReturnRequest) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => { setDetailTarget(record); setDetailModalOpen(true); }}
            />
          </Tooltip>
          {record.status === "requested" && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenProcess(record, "approve")}
              >
                Approve
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenProcess(record, "reject")}
              >
                Reject
              </Button>
            </>
          )}
          {record.status === "approved" && (
            <Button size="small" icon={<InboxOutlined />} onClick={() => handleMarkReceived(record.id)}>
              Mark Received
            </Button>
          )}
          {record.status === "received" && (
            <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => handleIssueRefund(record.id)}>
              Issue Refund
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Returns & Refunds"
        subtitle="Process return requests, manage refunds, and track return analytics"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Pending Requests" value={stats.requested} valueStyle={{ color: "#d97706" }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Approved" value={stats.approved} valueStyle={{ color: "#0f6fa8" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Refunded" value={stats.refunded} valueStyle={{ color: "#15803d" }} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Rejected" value={stats.rejected} valueStyle={{ color: "#dc2626" }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Refunded" value={stats.totalRefunded} precision={2} prefix="$" />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Return Rate" value={stats.returnRate} suffix="%" prefix={<RollbackOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "requests",
            label: <span><FileTextOutlined /> Return Requests</span>,
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
                  dataSource={filteredReturns}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 10, showTotal: (total) => `${total} returns` }}
                />
              </Card>
            ),
          },
          {
            key: "analytics",
            label: <span><BarChartOutlined /> Return Reasons</span>,
            children: (
              <Card title="Return Reasons Analytics">
                <Row gutter={[24, 16]}>
                  <Col xs={24} md={12}>
                    <List
                      dataSource={reasonStats}
                      renderItem={(item) => (
                        <List.Item>
                          <div style={{ width: "100%" }}>
                            <Space style={{ justifyContent: "space-between", width: "100%", marginBottom: 4 }}>
                              <Text strong style={{ fontSize: 13 }}>{item.reason}</Text>
                              <Space size={8}>
                                <Badge count={item.count} style={{ backgroundColor: item.color }} />
                                <Text type="secondary">{item.percentage.toFixed(1)}%</Text>
                              </Space>
                            </Space>
                            <Progress
                              percent={item.percentage}
                              showInfo={false}
                              strokeColor={item.color}
                              style={{ margin: 0 }}
                            />
                          </div>
                        </List.Item>
                      )}
                    />
                  </Col>
                  <Col xs={24} md={12}>
                    <Card size="small" style={{ backgroundColor: "#fafafa" }}>
                      <Space orientation="vertical" style={{ width: "100%" }} size={12}>
                        <Text strong>Key Insights</Text>
                        <div>
                          <Tag color="red">Defective Products</Tag>
                          <Text style={{ fontSize: 12 }}>
                            accounts for the largest share of returns. Consider quality control review.
                          </Text>
                        </div>
                        <div>
                          <Tag color="orange">Wrong Size</Tag>
                          <Text style={{ fontSize: 12 }}>
                            suggests sizing guide improvements could reduce returns by up to 15%.
                          </Text>
                        </div>
                        <div>
                          <Tag color="blue">Shipping Damage</Tag>
                          <Text style={{ fontSize: 12 }}>
                            review packaging standards with fulfillment team.
                          </Text>
                        </div>
                        <Divider style={{ margin: "8px 0" }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Overall return rate of {stats.returnRate}% is within industry average (3-5% for eCommerce).
                        </Text>
                      </Space>
                    </Card>
                  </Col>
                </Row>
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={processAction === "approve" ? "Approve Return & Process Refund" : "Reject Return Request"}
        open={processModalOpen}
        onOk={handleProcessReturn}
        onCancel={() => setProcessModalOpen(false)}
        okText={processAction === "approve" ? "Approve & Refund" : "Reject Return"}
        okButtonProps={{ danger: processAction === "reject" }}
        width={520}
      >
        {processTarget && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Order">{processTarget.orderNumber}</Descriptions.Item>
              <Descriptions.Item label="Customer">{processTarget.customerName}</Descriptions.Item>
              <Descriptions.Item label="Reason">{processTarget.reason}</Descriptions.Item>
              <Descriptions.Item label="Items">
                {processTarget.items.map((item, i) => (
                  <div key={i}>{item.quantity}x {item.name} - {formatCurrency(item.price)}</div>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label="Total">{formatCurrency(processTarget.totalAmount)}</Descriptions.Item>
            </Descriptions>

            {processTarget.reasonDetail && (
              <Card size="small" style={{ backgroundColor: "#fff7e6" }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Customer's explanation:</Text>
                <div><Text style={{ fontSize: 13 }}>{processTarget.reasonDetail}</Text></div>
              </Card>
            )}

            {processAction === "approve" && (
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>Refund Type</Text>
                <Radio.Group value={refundType} onChange={(e) => setRefundType(e.target.value)}>
                  <Space orientation="vertical">
                    <Radio value="full">
                      Full Refund ({formatCurrency(processTarget.totalAmount)})
                    </Radio>
                    <Radio value="partial">
                      Partial Refund
                      {refundType === "partial" && (
                        <InputNumber
                          value={partialAmount}
                          onChange={(v) => setPartialAmount(v || 0)}
                          min={0}
                          max={processTarget.totalAmount}
                          prefix="$"
                          style={{ width: 120, marginLeft: 8 }}
                        />
                      )}
                    </Radio>
                    <Radio value="store_credit">
                      Store Credit ({formatCurrency(processTarget.totalAmount)})
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>
            )}

            <div>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Notes</Text>
              <TextArea
                rows={3}
                value={processNotes}
                onChange={(e) => setProcessNotes(e.target.value)}
                placeholder={processAction === "reject" ? "Reason for rejection (required for rejected returns)..." : "Optional notes..."}
              />
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title="Return Details"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={560}
      >
        {detailTarget && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Return ID">{detailTarget.id.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="Order">{detailTarget.orderNumber}</Descriptions.Item>
              <Descriptions.Item label="Customer">{detailTarget.customerName}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailTarget.customerEmail}</Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Tag color={statusConfig[detailTarget.status]?.color} icon={statusConfig[detailTarget.status]?.icon}>
                  {statusConfig[detailTarget.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Requested">{formatDate(detailTarget.requestedDate)}</Descriptions.Item>
              <Descriptions.Item label="Processed">{detailTarget.processedDate ? formatDate(detailTarget.processedDate) : "Pending"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Return Items">
              <List
                size="small"
                dataSource={detailTarget.items}
                renderItem={(item) => (
                  <List.Item extra={<Text strong>{formatCurrency(item.price * item.quantity)}</Text>}>
                    <List.Item.Meta
                      title={`${item.quantity}x ${item.name}`}
                      description={<Tag style={{ fontSize: 11, borderRadius: 4 }}>{item.reason}</Tag>}
                    />
                  </List.Item>
                )}
              />
              <Divider style={{ margin: "8px 0" }} />
              <div style={{ textAlign: "right" }}>
                <Text strong style={{ fontSize: 16 }}>Total: {formatCurrency(detailTarget.totalAmount)}</Text>
              </div>
            </Card>

            {detailTarget.reasonDetail && (
              <Card size="small" title="Customer's Explanation">
                <Text>{detailTarget.reasonDetail}</Text>
              </Card>
            )}

            {detailTarget.refundAmount && (
              <Card size="small" title="Refund Details">
                <Space split={<Divider type="vertical" />}>
                  <Text>Type: <Text strong>{detailTarget.refundType === "store_credit" ? "Store Credit" : detailTarget.refundType === "partial" ? "Partial" : "Full"}</Text></Text>
                  <Text>Amount: <Text strong style={{ color: "#15803d" }}>{formatCurrency(detailTarget.refundAmount)}</Text></Text>
                </Space>
              </Card>
            )}

            {detailTarget.notes && (
              <Card size="small" title="Notes">
                <Text>{detailTarget.notes}</Text>
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ReturnList;
