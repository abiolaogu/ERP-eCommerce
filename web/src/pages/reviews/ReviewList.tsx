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
  Rate,
  Avatar,
  List,
  Badge,
  Divider,
  Select,
  Progress,
} from "antd";
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  UserOutlined,
  LikeOutlined,
  DislikeOutlined,
  SmileOutlined,
  MehOutlined,
  FrownOutlined,
  EyeOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatDate, formatRelativeTime } from "@/utils/formatters";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Review {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  rating: number;
  title: string;
  text: string;
  status: "pending" | "approved" | "rejected";
  sentiment: "positive" | "neutral" | "negative";
  helpful: number;
  notHelpful: number;
  reply?: string;
  repliedAt?: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

interface ProductRatingSummary {
  productName: string;
  avgRating: number;
  totalReviews: number;
  distribution: number[];
}

const mockReviews: Review[] = [
  { id: "r1", productId: "1", productName: "Wireless Headphones Pro", customerId: "c1", customerName: "Sarah Johnson", rating: 5, title: "Best headphones I ever owned!", text: "The noise cancellation is incredible. Battery life exceeds expectations. Comfortable for long listening sessions. Highly recommend!", status: "approved", sentiment: "positive", helpful: 24, notHelpful: 1, verifiedPurchase: true, createdAt: "2026-02-25T14:30:00Z" },
  { id: "r2", productId: "3", productName: "Smart Watch Series 5", customerId: "c2", customerName: "Michael Chen", rating: 4, title: "Great watch, minor issues", text: "Excellent fitness tracking and battery life. The screen is vibrant. Only downside is the GPS accuracy could be better during outdoor runs.", status: "approved", sentiment: "positive", helpful: 12, notHelpful: 2, reply: "Thank you for your feedback! We're working on GPS improvements in the next firmware update.", repliedAt: "2026-02-26T10:00:00Z", verifiedPurchase: true, createdAt: "2026-02-24T09:15:00Z" },
  { id: "r3", productId: "2", productName: "Organic Cotton T-Shirt", customerId: "c3", customerName: "Emily Davis", rating: 3, title: "Okay quality, sizing runs small", text: "The fabric feels nice but the sizing is off. I ordered my usual size and it was quite tight. Had to exchange for a larger one. Material quality is decent for the price.", status: "pending", sentiment: "neutral", helpful: 8, notHelpful: 3, verifiedPurchase: true, createdAt: "2026-02-27T16:45:00Z" },
  { id: "r4", productId: "4", productName: "Running Shoes Ultra", customerId: "c4", customerName: "James Wilson", rating: 5, title: "Perfect running companion", text: "These shoes are incredibly lightweight and supportive. Ran my first marathon in them without any blisters. The cushioning is on another level!", status: "approved", sentiment: "positive", helpful: 31, notHelpful: 0, verifiedPurchase: true, createdAt: "2026-02-22T11:00:00Z" },
  { id: "r5", productId: "1", productName: "Wireless Headphones Pro", customerId: "c5", customerName: "Anna Martinez", rating: 1, title: "Broke after 2 weeks", text: "Left earphone stopped working after 2 weeks of normal use. Very disappointed for the price point. Customer service has been slow to respond.", status: "pending", sentiment: "negative", helpful: 5, notHelpful: 8, verifiedPurchase: true, createdAt: "2026-02-28T08:20:00Z" },
  { id: "r6", productId: "5", productName: "Portable Bluetooth Speaker", customerId: "c6", customerName: "David Kim", rating: 4, title: "Great sound for the size", text: "Impressive bass for such a compact speaker. Waterproof feature works great at the pool. Battery could be a bit better.", status: "approved", sentiment: "positive", helpful: 15, notHelpful: 1, verifiedPurchase: false, createdAt: "2026-02-20T13:30:00Z" },
  { id: "r7", productId: "7", productName: "Yoga Mat Professional", customerId: "c7", customerName: "Lisa Taylor", rating: 2, title: "Not worth the premium price", text: "For the price they charge, I expected better grip. It slides on hardwood floors and the material started peeling after a month of regular use.", status: "pending", sentiment: "negative", helpful: 9, notHelpful: 4, verifiedPurchase: true, createdAt: "2026-02-27T20:00:00Z" },
  { id: "r8", productId: "3", productName: "Smart Watch Series 5", customerId: "c8", customerName: "Robert Brown", rating: 5, title: "Exceeded all expectations", text: "The sleep tracking is amazingly accurate. Love the always-on display. Integration with my phone is seamless. Best smartwatch I have used.", status: "approved", sentiment: "positive", helpful: 18, notHelpful: 0, verifiedPurchase: true, createdAt: "2026-02-18T07:45:00Z" },
  { id: "r9", productId: "2", productName: "Organic Cotton T-Shirt", customerId: "c9", customerName: "Karen White", rating: 4, title: "Soft and comfortable", text: "Love the feel of organic cotton. Color stayed vibrant after several washes. Good value for money. Will order more colors.", status: "approved", sentiment: "positive", helpful: 7, notHelpful: 1, verifiedPurchase: true, createdAt: "2026-02-15T12:00:00Z" },
  { id: "r10", productId: "4", productName: "Running Shoes Ultra", customerId: "c10", customerName: "Tom Anderson", rating: 3, title: "Good but not great", text: "Comfortable for short runs but my feet hurt on longer ones. The arch support is not enough for flat feet. Design looks great though.", status: "pending", sentiment: "neutral", helpful: 4, notHelpful: 2, verifiedPurchase: false, createdAt: "2026-02-26T15:30:00Z" },
];

const ReviewList: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [reviews, setReviews] = useState(mockReviews);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Review | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();

  const stats = useMemo(() => {
    const total = reviews.length;
    const pending = reviews.filter((r) => r.status === "pending").length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const positive = reviews.filter((r) => r.sentiment === "positive").length;
    const neutral = reviews.filter((r) => r.sentiment === "neutral").length;
    const negative = reviews.filter((r) => r.sentiment === "negative").length;
    return { total, pending, approved, avgRating, positive, neutral, negative };
  }, [reviews]);

  const productSummaries = useMemo<ProductRatingSummary[]>(() => {
    const grouped: Record<string, Review[]> = {};
    reviews.forEach((r) => {
      if (!grouped[r.productName]) grouped[r.productName] = [];
      grouped[r.productName].push(r);
    });
    return Object.entries(grouped).map(([name, revs]) => ({
      productName: name,
      avgRating: revs.reduce((s, r) => s + r.rating, 0) / revs.length,
      totalReviews: revs.length,
      distribution: [1, 2, 3, 4, 5].map((star) => revs.filter((r) => r.rating === star).length),
    })).sort((a, b) => b.totalReviews - a.totalReviews);
  }, [reviews]);

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch = !searchText || r.productName.toLowerCase().includes(searchText.toLowerCase()) || r.customerName.toLowerCase().includes(searchText.toLowerCase()) || r.text.toLowerCase().includes(searchText.toLowerCase());
    const matchesTab = activeTab === "all" || r.status === activeTab;
    const matchesRating = !ratingFilter || r.rating === ratingFilter;
    return matchesSearch && matchesTab && matchesRating;
  });

  const handleApprove = (id: string) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" as const } : r)));
    message.success("Review approved");
  };

  const handleReject = (id: string) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r)));
    message.success("Review rejected");
  };

  const handleReply = () => {
    if (!replyTarget || !replyText.trim()) return;
    setReviews((prev) =>
      prev.map((r) =>
        r.id === replyTarget.id
          ? { ...r, reply: replyText, repliedAt: new Date().toISOString() }
          : r
      )
    );
    setReplyModalOpen(false);
    setReplyText("");
    message.success("Reply posted");
  };

  const sentimentIcon = (sentiment: string) => {
    if (sentiment === "positive") return <SmileOutlined style={{ color: "#15803d" }} />;
    if (sentiment === "negative") return <FrownOutlined style={{ color: "#dc2626" }} />;
    return <MehOutlined style={{ color: "#d97706" }} />;
  };

  const columns = [
    {
      title: "Customer",
      key: "customer",
      width: 160,
      render: (_: unknown, record: Review) => (
        <Space>
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: "#0f6fa815", color: "#0f6fa8" }}>
            {record.customerName.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{record.customerName}</Text>
            {record.verifiedPurchase && (
              <div>
                <Tag color="green" style={{ fontSize: 10, padding: "0 4px", borderRadius: 4 }}>
                  Verified
                </Tag>
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: "Product",
      dataIndex: "productName",
      key: "productName",
      width: 180,
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: "Rating",
      dataIndex: "rating",
      key: "rating",
      width: 130,
      render: (rating: number) => <Rate disabled value={rating} style={{ fontSize: 14 }} />,
      sorter: (a: Review, b: Review) => a.rating - b.rating,
    },
    {
      title: "Review",
      key: "review",
      width: 300,
      render: (_: unknown, record: Review) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{record.title}</Text>
          <Paragraph
            type="secondary"
            ellipsis={{ rows: 2 }}
            style={{ fontSize: 12, marginBottom: 4 }}
          >
            {record.text}
          </Paragraph>
          {record.reply && (
            <Tag icon={<MessageOutlined />} color="blue" style={{ fontSize: 11, borderRadius: 4 }}>
              Replied
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Sentiment",
      dataIndex: "sentiment",
      key: "sentiment",
      width: 100,
      render: (sentiment: string) => (
        <Space size={4}>
          {sentimentIcon(sentiment)}
          <Text style={{ fontSize: 12, textTransform: "capitalize" }}>{sentiment}</Text>
        </Space>
      ),
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (date: string) => (
        <Tooltip title={formatDate(date)}>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatRelativeTime(date)}</Text>
        </Tooltip>
      ),
      sorter: (a: Review, b: Review) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_: unknown, record: Review) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => { setDetailTarget(record); setDetailModalOpen(true); }}
            />
          </Tooltip>
          {record.status === "pending" && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="text"
                  size="small"
                  style={{ color: "#15803d" }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(record.id)}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleReject(record.id)}
                />
              </Tooltip>
            </>
          )}
          <Tooltip title="Reply">
            <Button
              type="text"
              size="small"
              icon={<MessageOutlined />}
              onClick={() => { setReplyTarget(record); setReplyText(record.reply || ""); setReplyModalOpen(true); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reviews & Ratings"
        subtitle="Moderate customer reviews, manage ratings, and respond to feedback"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Reviews" value={stats.total} prefix={<StarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Pending" value={stats.pending} valueStyle={{ color: "#d97706" }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Avg Rating"
              value={stats.avgRating}
              precision={1}
              prefix={<StarFilled style={{ color: "#faad14" }} />}
              suffix="/ 5"
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Positive" value={stats.positive} valueStyle={{ color: "#15803d" }} prefix={<SmileOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Neutral" value={stats.neutral} valueStyle={{ color: "#d97706" }} prefix={<MehOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Negative" value={stats.negative} valueStyle={{ color: "#dc2626" }} prefix={<FrownOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="Product Rating Summary" size="small">
            <Row gutter={[24, 16]}>
              {productSummaries.slice(0, 4).map((ps) => (
                <Col xs={24} sm={12} md={6} key={ps.productName}>
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <Text strong style={{ fontSize: 13 }}>{ps.productName}</Text>
                    <div style={{ margin: "4px 0" }}>
                      <Rate disabled value={Math.round(ps.avgRating)} style={{ fontSize: 14 }} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {ps.avgRating.toFixed(1)} avg ({ps.totalReviews} reviews)
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      {[5, 4, 3, 2, 1].map((star) => (
                        <div key={star} style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                          <Text style={{ fontSize: 11, width: 12 }}>{star}</Text>
                          <StarFilled style={{ fontSize: 10, color: "#faad14" }} />
                          <Progress
                            percent={ps.totalReviews > 0 ? (ps.distribution[star - 1] / ps.totalReviews) * 100 : 0}
                            size="small"
                            showInfo={false}
                            style={{ width: 60, margin: 0 }}
                            strokeColor="#faad14"
                          />
                          <Text type="secondary" style={{ fontSize: 10, width: 16 }}>{ps.distribution[star - 1]}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 16 }}
          items={[
            { key: "pending", label: <span><ClockCircleOutlined /> Pending ({stats.pending})</span> },
            { key: "approved", label: <span><CheckCircleOutlined /> Approved ({stats.approved})</span> },
            { key: "all", label: "All Reviews" },
          ]}
        />
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Input
            placeholder="Search reviews..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by rating"
            allowClear
            value={ratingFilter}
            onChange={setRatingFilter}
            style={{ width: 160 }}
            options={[5, 4, 3, 2, 1].map((r) => ({ label: `${r} Star${r > 1 ? "s" : ""}`, value: r }))}
          />
        </div>
        <Table
          dataSource={filteredReviews}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} reviews` }}
        />
      </Card>

      <Modal
        title="Reply to Review"
        open={replyModalOpen}
        onOk={handleReply}
        onCancel={() => setReplyModalOpen(false)}
        okText="Post Reply"
        okButtonProps={{ disabled: !replyText.trim() }}
      >
        {replyTarget && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Card size="small" style={{ backgroundColor: "#fafafa" }}>
              <Space orientation="vertical" size={4}>
                <Space>
                  <Text strong>{replyTarget.customerName}</Text>
                  <Rate disabled value={replyTarget.rating} style={{ fontSize: 12 }} />
                </Space>
                <Text style={{ fontSize: 13 }}>{replyTarget.title}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{replyTarget.text}</Text>
              </Space>
            </Card>
            <div>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Your Reply</Text>
              <TextArea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a thoughtful response to the customer..."
              />
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title="Review Details"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={
          detailTarget?.status === "pending" ? (
            <Space>
              <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => { handleReject(detailTarget.id); setDetailModalOpen(false); }}>
                Reject
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => { handleApprove(detailTarget.id); setDetailModalOpen(false); }}>
                Approve
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
                <div>
                  <Rate disabled value={detailTarget.rating} style={{ fontSize: 14 }} />
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {formatDate(detailTarget.createdAt)}
                  </Text>
                </div>
              </div>
            </Space>
            <div>
              <Text strong style={{ fontSize: 14, display: "block" }}>{detailTarget.title}</Text>
              <Text style={{ fontSize: 13, marginTop: 8, display: "block", lineHeight: 1.6 }}>
                {detailTarget.text}
              </Text>
            </div>
            <Space split={<Divider type="vertical" />}>
              <Text type="secondary" style={{ fontSize: 12 }}>Product: {detailTarget.productName}</Text>
              <Space size={4}>
                {sentimentIcon(detailTarget.sentiment)}
                <Text style={{ fontSize: 12, textTransform: "capitalize" }}>{detailTarget.sentiment}</Text>
              </Space>
              {detailTarget.verifiedPurchase && <Tag color="green" style={{ fontSize: 10, borderRadius: 4 }}>Verified Purchase</Tag>}
            </Space>
            <Space>
              <Tag icon={<LikeOutlined />}>{detailTarget.helpful} helpful</Tag>
              <Tag icon={<DislikeOutlined />}>{detailTarget.notHelpful} not helpful</Tag>
            </Space>
            {detailTarget.reply && (
              <Card size="small" style={{ backgroundColor: "#f0f7ff", borderColor: "#b3d4fc" }}>
                <Text strong style={{ fontSize: 12, color: "#0f6fa8" }}>Store Reply</Text>
                <br />
                <Text style={{ fontSize: 13 }}>{detailTarget.reply}</Text>
                {detailTarget.repliedAt && (
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                    Replied {formatRelativeTime(detailTarget.repliedAt)}
                  </Text>
                )}
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ReviewList;
