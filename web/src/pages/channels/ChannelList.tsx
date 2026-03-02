import React, { useState } from "react";
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  Tooltip,
  message,
  Badge,
  Divider,
  Alert,
  Switch,
  List,
  Avatar,
  Progress,
  Table,
} from "antd";
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  CloudSyncOutlined,
  ApiOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatNumber, formatDate, formatRelativeTime } from "@/utils/formatters";

const { Text, Title, Paragraph } = Typography;

interface Channel {
  id: string;
  name: string;
  platform: "shopify" | "amazon" | "ebay" | "instagram" | "tiktok";
  status: "connected" | "disconnected" | "error" | "syncing";
  storeName?: string;
  storeUrl?: string;
  productsSynced: number;
  totalProducts: number;
  ordersSynced: number;
  totalOrders: number;
  lastSync: string;
  autoSync: boolean;
  syncInterval: string;
  revenue: number;
  errors: number;
  connectedAt: string;
}

interface SyncConflict {
  id: string;
  channel: string;
  productName: string;
  field: string;
  localValue: string;
  remoteValue: string;
  detectedAt: string;
}

const platformConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  shopify: { color: "#95BF47", bgColor: "#95BF4715", label: "Shopify" },
  amazon: { color: "#FF9900", bgColor: "#FF990015", label: "Amazon" },
  ebay: { color: "#E53238", bgColor: "#E5323815", label: "eBay" },
  instagram: { color: "#E1306C", bgColor: "#E1306C15", label: "Instagram Shop" },
  tiktok: { color: "#000000", bgColor: "#00000010", label: "TikTok Shop" },
};

const mockChannels: Channel[] = [
  { id: "ch1", name: "Primary Shopify Store", platform: "shopify", status: "connected", storeName: "MyBrand Official", storeUrl: "mybrand.myshopify.com", productsSynced: 245, totalProducts: 250, ordersSynced: 1842, totalOrders: 1842, lastSync: "2026-02-28T10:30:00Z", autoSync: true, syncInterval: "15 min", revenue: 125430, errors: 0, connectedAt: "2025-06-15" },
  { id: "ch2", name: "Amazon Marketplace", platform: "amazon", status: "connected", storeName: "MyBrand on Amazon", storeUrl: "amazon.com/mybrand", productsSynced: 180, totalProducts: 200, ordersSynced: 3456, totalOrders: 3460, lastSync: "2026-02-28T10:15:00Z", autoSync: true, syncInterval: "30 min", revenue: 287650, errors: 4, connectedAt: "2025-08-20" },
  { id: "ch3", name: "eBay Store", platform: "ebay", status: "error", storeName: "MyBrand eBay", storeUrl: "ebay.com/mybrand", productsSynced: 120, totalProducts: 150, ordersSynced: 890, totalOrders: 895, lastSync: "2026-02-27T22:00:00Z", autoSync: true, syncInterval: "1 hour", revenue: 45320, errors: 12, connectedAt: "2025-10-05" },
  { id: "ch4", name: "Instagram Shopping", platform: "instagram", status: "connected", storeName: "@mybrand_official", storeUrl: "instagram.com/mybrand_official", productsSynced: 95, totalProducts: 100, ordersSynced: 567, totalOrders: 567, lastSync: "2026-02-28T09:45:00Z", autoSync: true, syncInterval: "1 hour", revenue: 34890, errors: 0, connectedAt: "2025-11-12" },
  { id: "ch5", name: "TikTok Shop", platform: "tiktok", status: "disconnected", storeName: "MyBrand TikTok", storeUrl: "tiktok.com/@mybrand", productsSynced: 0, totalProducts: 50, ordersSynced: 0, totalOrders: 234, lastSync: "2026-02-15T16:00:00Z", autoSync: false, syncInterval: "manual", revenue: 12780, errors: 0, connectedAt: "2026-01-08" },
];

const mockConflicts: SyncConflict[] = [
  { id: "cf1", channel: "Amazon Marketplace", productName: "Wireless Headphones Pro", field: "Price", localValue: "$149.99", remoteValue: "$139.99", detectedAt: "2026-02-28T10:00:00Z" },
  { id: "cf2", channel: "Amazon Marketplace", productName: "Smart Watch Series 5", field: "Stock", localValue: "89", remoteValue: "75", detectedAt: "2026-02-28T09:30:00Z" },
  { id: "cf3", channel: "eBay Store", productName: "Running Shoes Ultra", field: "Title", localValue: "Running Shoes Ultra", remoteValue: "Ultra Running Shoes - Premium", detectedAt: "2026-02-27T22:00:00Z" },
  { id: "cf4", channel: "eBay Store", productName: "Portable Bluetooth Speaker", field: "Description", localValue: "Waterproof portable bluetooth speaker", remoteValue: "Premium Waterproof BT Speaker", detectedAt: "2026-02-27T22:00:00Z" },
];

const ChannelList: React.FC = () => {
  const [channels, setChannels] = useState(mockChannels);
  const [conflicts, setConflicts] = useState(mockConflicts);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [form] = Form.useForm();

  const stats = {
    connected: channels.filter((c) => c.status === "connected").length,
    totalProductsSynced: channels.reduce((s, c) => s + c.productsSynced, 0),
    totalOrdersSynced: channels.reduce((s, c) => s + c.ordersSynced, 0),
    totalRevenue: channels.reduce((s, c) => s + c.revenue, 0),
    errors: channels.reduce((s, c) => s + c.errors, 0),
    conflictCount: conflicts.length,
  };

  const handleSync = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, status: "syncing" as const, lastSync: new Date().toISOString() } : c))
    );
    message.loading("Syncing channel...");
    setTimeout(() => {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId
            ? { ...c, status: "connected" as const, lastSync: new Date().toISOString(), productsSynced: c.totalProducts, ordersSynced: c.totalOrders }
            : c
        )
      );
      message.success("Channel synced successfully");
    }, 2000);
  };

  const handleToggleAutoSync = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, autoSync: !c.autoSync } : c))
    );
    message.success("Auto-sync setting updated");
  };

  const handleConnect = () => {
    form.validateFields().then((values) => {
      const platform = values.platform as string;
      const newChannel: Channel = {
        id: `ch-${Date.now()}`,
        name: values.name,
        platform: platform as Channel["platform"],
        status: "connected",
        storeName: values.storeName,
        storeUrl: values.storeUrl,
        productsSynced: 0,
        totalProducts: 0,
        ordersSynced: 0,
        totalOrders: 0,
        lastSync: new Date().toISOString(),
        autoSync: true,
        syncInterval: "30 min",
        revenue: 0,
        errors: 0,
        connectedAt: new Date().toISOString(),
      };
      setChannels((prev) => [...prev, newChannel]);
      setSetupModalOpen(false);
      form.resetFields();
      message.success(`${platformConfig[platform]?.label || platform} channel connected`);
    });
  };

  const handleResolveConflict = (conflictId: string, resolution: "local" | "remote") => {
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
    message.success(`Conflict resolved using ${resolution} value`);
  };

  const statusTag = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      connected: { color: "success", icon: <CheckCircleOutlined />, label: "Connected" },
      disconnected: { color: "default", icon: <DisconnectOutlined />, label: "Disconnected" },
      error: { color: "error", icon: <ExclamationCircleOutlined />, label: "Error" },
      syncing: { color: "processing", icon: <SyncOutlined spin />, label: "Syncing" },
    };
    const c = config[status] || config.connected;
    return <Tag color={c.color} icon={c.icon} style={{ borderRadius: 6 }}>{c.label}</Tag>;
  };

  return (
    <div>
      <PageHeader
        title="Multi-Channel Sync"
        subtitle="Connect and manage sales channels across multiple platforms"
        extra={
          <Space>
            {stats.conflictCount > 0 && (
              <Badge count={stats.conflictCount}>
                <Button icon={<WarningOutlined />} onClick={() => setConflictModalOpen(true)}>
                  Conflicts
                </Button>
              </Badge>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setSetupModalOpen(true)}>
              Connect Channel
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Connected" value={stats.connected} suffix={`/ ${channels.length}`} prefix={<LinkOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Products Synced" value={stats.totalProductsSynced} prefix={<ShopOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Orders Synced" value={stats.totalOrdersSynced} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Revenue" value={stats.totalRevenue} prefix="$" precision={0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Sync Errors" value={stats.errors} valueStyle={{ color: stats.errors > 0 ? "#dc2626" : undefined }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Conflicts" value={stats.conflictCount} valueStyle={{ color: stats.conflictCount > 0 ? "#d97706" : undefined }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {channels.map((channel) => {
          const pc = platformConfig[channel.platform];
          return (
            <Col xs={24} md={12} lg={8} key={channel.id}>
              <Card
                style={{ borderTop: `3px solid ${pc.color}` }}
                actions={[
                  <Tooltip title="Sync Now" key="sync">
                    <Button
                      type="text"
                      icon={<SyncOutlined spin={channel.status === "syncing"} />}
                      disabled={channel.status === "disconnected"}
                      onClick={() => handleSync(channel.id)}
                    >
                      Sync
                    </Button>
                  </Tooltip>,
                  <Tooltip title="Settings" key="settings">
                    <Button type="text" icon={<SettingOutlined />} onClick={() => message.info("Channel settings")}>
                      Settings
                    </Button>
                  </Tooltip>,
                  <Tooltip title={channel.status === "disconnected" ? "Reconnect" : "Disconnect"} key="toggle">
                    <Button
                      type="text"
                      danger={channel.status !== "disconnected"}
                      icon={channel.status === "disconnected" ? <LinkOutlined /> : <DisconnectOutlined />}
                      onClick={() => {
                        setChannels((prev) =>
                          prev.map((c) =>
                            c.id === channel.id
                              ? { ...c, status: c.status === "disconnected" ? "connected" as const : "disconnected" as const }
                              : c
                          )
                        );
                        message.success(channel.status === "disconnected" ? "Channel reconnected" : "Channel disconnected");
                      }}
                    >
                      {channel.status === "disconnected" ? "Connect" : "Disconnect"}
                    </Button>
                  </Tooltip>,
                ]}
              >
                <Space orientation="vertical" style={{ width: "100%" }} size={12}>
                  <Space style={{ justifyContent: "space-between", width: "100%" }}>
                    <Space>
                      <Avatar
                        style={{ backgroundColor: pc.bgColor, color: pc.color }}
                        icon={<GlobalOutlined />}
                        size={40}
                      />
                      <div>
                        <Text strong style={{ fontSize: 15 }}>{channel.name}</Text>
                        <div>{statusTag(channel.status)}</div>
                      </div>
                    </Space>
                  </Space>

                  {channel.storeName && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <LinkOutlined style={{ marginRight: 4 }} />
                      {channel.storeName} - {channel.storeUrl}
                    </Text>
                  )}

                  <Row gutter={16}>
                    <Col span={12}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Products Synced</Text>
                        <div>
                          <Text strong>{channel.productsSynced}</Text>
                          <Text type="secondary"> / {channel.totalProducts}</Text>
                        </div>
                        <Progress
                          percent={channel.totalProducts > 0 ? Math.round((channel.productsSynced / channel.totalProducts) * 100) : 0}
                          size="small"
                          showInfo={false}
                          strokeColor={pc.color}
                          style={{ margin: 0 }}
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Orders Synced</Text>
                        <div>
                          <Text strong>{formatNumber(channel.ordersSynced)}</Text>
                          <Text type="secondary"> / {formatNumber(channel.totalOrders)}</Text>
                        </div>
                        <Progress
                          percent={channel.totalOrders > 0 ? Math.round((channel.ordersSynced / channel.totalOrders) * 100) : 0}
                          size="small"
                          showInfo={false}
                          strokeColor={pc.color}
                          style={{ margin: 0 }}
                        />
                      </div>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "4px 0" }} />

                  <Space style={{ justifyContent: "space-between", width: "100%" }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      Last sync: {formatRelativeTime(channel.lastSync)}
                    </Text>
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Auto-sync</Text>
                      <Switch
                        size="small"
                        checked={channel.autoSync}
                        onChange={() => handleToggleAutoSync(channel.id)}
                      />
                    </Space>
                  </Space>

                  {channel.errors > 0 && (
                    <Alert
                      title={`${channel.errors} sync error${channel.errors > 1 ? "s" : ""} detected`}
                      type="error"
                      showIcon
                      style={{ fontSize: 12 }}
                    />
                  )}
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal
        title="Connect Sales Channel"
        open={setupModalOpen}
        onOk={handleConnect}
        onCancel={() => { setSetupModalOpen(false); form.resetFields(); }}
        okText="Connect Channel"
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="platform" label="Platform" rules={[{ required: true }]}>
            <Select
              placeholder="Select platform"
              options={Object.entries(platformConfig).map(([key, val]) => ({
                label: (
                  <Space>
                    <span style={{ color: val.color, fontWeight: 600 }}>{val.label}</span>
                  </Space>
                ),
                value: key,
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label="Channel Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., My Shopify Store" />
          </Form.Item>
          <Form.Item name="storeName" label="Store Name">
            <Input placeholder="e.g., MyBrand Official" />
          </Form.Item>
          <Form.Item name="storeUrl" label="Store URL">
            <Input placeholder="e.g., mybrand.myshopify.com" prefix={<LinkOutlined />} />
          </Form.Item>
          <Alert
            title="You will be redirected to authorize the connection after clicking Connect."
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      <Modal
        title={`Sync Conflicts (${conflicts.length})`}
        open={conflictModalOpen}
        onCancel={() => setConflictModalOpen(false)}
        footer={null}
        width={700}
      >
        {conflicts.length === 0 ? (
          <Alert title="No sync conflicts to resolve." type="success" showIcon />
        ) : (
          <List
            dataSource={conflicts}
            renderItem={(conflict) => (
              <List.Item
                actions={[
                  <Button
                    size="small"
                    key="local"
                    onClick={() => handleResolveConflict(conflict.id, "local")}
                  >
                    Use Local
                  </Button>,
                  <Button
                    size="small"
                    type="primary"
                    key="remote"
                    onClick={() => handleResolveConflict(conflict.id, "remote")}
                  >
                    Use Remote
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<WarningOutlined style={{ fontSize: 20, color: "#d97706" }} />}
                  title={
                    <Space>
                      <Text strong>{conflict.productName}</Text>
                      <Tag>{conflict.field}</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>via {conflict.channel}</Text>
                    </Space>
                  }
                  description={
                    <Space split={<span style={{ color: "#d9d9d9" }}>vs</span>}>
                      <Tag color="blue">Local: {conflict.localValue}</Tag>
                      <Tag color="orange">Remote: {conflict.remoteValue}</Tag>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default ChannelList;
