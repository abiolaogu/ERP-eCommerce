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
  Tabs,
  Alert,
  Progress,
  Tooltip,
  message,
  Badge,
  List,
  Divider,
  Radio,
} from "antd";
import {
  SearchOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  MinusOutlined,
  SwapOutlined,
  ReloadOutlined,
  ShopOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  BellOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatNumber, formatCurrency } from "@/utils/formatters";

const { Text, Title } = Typography;

interface WarehouseStock {
  id: string;
  productName: string;
  sku: string;
  warehouse: string;
  available: number;
  reserved: number;
  incoming: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number;
  lastRestocked: string;
  velocity: number; // units sold per week
}

interface StockAlert {
  id: string;
  productName: string;
  sku: string;
  warehouse: string;
  type: "low_stock" | "out_of_stock" | "overstock";
  currentStock: number;
  threshold: number;
  severity: "critical" | "warning" | "info";
  createdAt: string;
}

const mockStockData: WarehouseStock[] = [
  { id: "1", productName: "Wireless Headphones Pro", sku: "WHP-001", warehouse: "Main Warehouse", available: 342, reserved: 28, incoming: 0, reorderPoint: 100, reorderQty: 500, unitCost: 45.00, lastRestocked: "2026-02-15", velocity: 48 },
  { id: "2", productName: "Organic Cotton T-Shirt", sku: "OCT-002", warehouse: "Main Warehouse", available: 1250, reserved: 67, incoming: 200, reorderPoint: 300, reorderQty: 1000, unitCost: 8.50, lastRestocked: "2026-02-20", velocity: 92 },
  { id: "3", productName: "Smart Watch Series 5", sku: "SWS-003", warehouse: "Main Warehouse", available: 12, reserved: 5, incoming: 0, reorderPoint: 50, reorderQty: 200, unitCost: 120.00, lastRestocked: "2026-01-10", velocity: 35 },
  { id: "4", productName: "Running Shoes Ultra", sku: "RSU-004", warehouse: "Main Warehouse", available: 567, reserved: 42, incoming: 150, reorderPoint: 200, reorderQty: 600, unitCost: 35.00, lastRestocked: "2026-02-18", velocity: 65 },
  { id: "5", productName: "Portable Bluetooth Speaker", sku: "PBS-005", warehouse: "East Distribution", available: 890, reserved: 31, incoming: 0, reorderPoint: 200, reorderQty: 500, unitCost: 18.00, lastRestocked: "2026-02-22", velocity: 55 },
  { id: "6", productName: "Leather Wallet Premium", sku: "LWP-006", warehouse: "East Distribution", available: 0, reserved: 0, incoming: 100, reorderPoint: 50, reorderQty: 200, unitCost: 15.00, lastRestocked: "2026-01-05", velocity: 22 },
  { id: "7", productName: "Yoga Mat Professional", sku: "YMP-007", warehouse: "West Fulfillment", available: 430, reserved: 18, incoming: 0, reorderPoint: 100, reorderQty: 400, unitCost: 12.00, lastRestocked: "2026-02-10", velocity: 38 },
  { id: "8", productName: "Stainless Steel Water Bottle", sku: "SSW-008", warehouse: "West Fulfillment", available: 45, reserved: 12, incoming: 0, reorderPoint: 100, reorderQty: 500, unitCost: 6.50, lastRestocked: "2026-01-28", velocity: 42 },
  { id: "9", productName: "Noise-Cancelling Earbuds", sku: "NCE-009", warehouse: "Main Warehouse", available: 78, reserved: 20, incoming: 300, reorderPoint: 150, reorderQty: 500, unitCost: 28.00, lastRestocked: "2026-02-05", velocity: 60 },
  { id: "10", productName: "Ceramic Coffee Mug Set", sku: "CCM-010", warehouse: "East Distribution", available: 2100, reserved: 15, incoming: 0, reorderPoint: 200, reorderQty: 500, unitCost: 4.00, lastRestocked: "2026-02-25", velocity: 20 },
  { id: "11", productName: "Wireless Headphones Pro", sku: "WHP-001", warehouse: "East Distribution", available: 156, reserved: 12, incoming: 0, reorderPoint: 80, reorderQty: 300, unitCost: 45.00, lastRestocked: "2026-02-12", velocity: 30 },
  { id: "12", productName: "Smart Watch Series 5", sku: "SWS-003", warehouse: "West Fulfillment", available: 0, reserved: 0, incoming: 100, reorderPoint: 30, reorderQty: 150, unitCost: 120.00, lastRestocked: "2025-12-20", velocity: 18 },
];

const mockAlerts: StockAlert[] = [
  { id: "a1", productName: "Smart Watch Series 5", sku: "SWS-003", warehouse: "Main Warehouse", type: "low_stock", currentStock: 12, threshold: 50, severity: "critical", createdAt: "2026-02-28T08:00:00Z" },
  { id: "a2", productName: "Leather Wallet Premium", sku: "LWP-006", warehouse: "East Distribution", type: "out_of_stock", currentStock: 0, threshold: 50, severity: "critical", createdAt: "2026-02-28T06:30:00Z" },
  { id: "a3", productName: "Smart Watch Series 5", sku: "SWS-003", warehouse: "West Fulfillment", type: "out_of_stock", currentStock: 0, threshold: 30, severity: "critical", createdAt: "2026-02-28T07:15:00Z" },
  { id: "a4", productName: "Stainless Steel Water Bottle", sku: "SSW-008", warehouse: "West Fulfillment", type: "low_stock", currentStock: 45, threshold: 100, severity: "warning", createdAt: "2026-02-27T14:00:00Z" },
  { id: "a5", productName: "Noise-Cancelling Earbuds", sku: "NCE-009", warehouse: "Main Warehouse", type: "low_stock", currentStock: 78, threshold: 150, severity: "warning", createdAt: "2026-02-27T10:00:00Z" },
  { id: "a6", productName: "Ceramic Coffee Mug Set", sku: "CCM-010", warehouse: "East Distribution", type: "overstock", currentStock: 2100, threshold: 200, severity: "info", createdAt: "2026-02-26T16:00:00Z" },
];

const InventoryDashboard: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>();
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<WarehouseStock | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [stockData, setStockData] = useState(mockStockData);
  const [activeTab, setActiveTab] = useState("overview");

  const stats = useMemo(() => {
    const totalSKUs = new Set(stockData.map((s) => s.sku)).size;
    const inStock = stockData.filter((s) => s.available > s.reorderPoint).length;
    const lowStock = stockData.filter((s) => s.available > 0 && s.available <= s.reorderPoint).length;
    const outOfStock = stockData.filter((s) => s.available === 0).length;
    const totalValue = stockData.reduce((sum, s) => sum + s.available * s.unitCost, 0);
    const totalUnits = stockData.reduce((sum, s) => sum + s.available, 0);
    return { totalSKUs, inStock, lowStock, outOfStock, totalValue, totalUnits };
  }, [stockData]);

  const filteredStock = stockData.filter((item) => {
    const matchesSearch = !searchText || item.productName.toLowerCase().includes(searchText.toLowerCase()) || item.sku.toLowerCase().includes(searchText.toLowerCase());
    const matchesWarehouse = !warehouseFilter || item.warehouse === warehouseFilter;
    return matchesSearch && matchesWarehouse;
  });

  const warehouses = [...new Set(stockData.map((s) => s.warehouse))];

  const restockSuggestions = useMemo(() => {
    return stockData
      .filter((s) => s.available <= s.reorderPoint && s.incoming === 0)
      .map((s) => ({
        ...s,
        weeksUntilStockout: s.velocity > 0 ? Math.round(s.available / s.velocity) : Infinity,
        suggestedQty: s.reorderQty,
        estimatedCost: s.reorderQty * s.unitCost,
      }))
      .sort((a, b) => a.weeksUntilStockout - b.weeksUntilStockout);
  }, [stockData]);

  const handleAdjust = (record: WarehouseStock) => {
    setAdjustTarget(record);
    setAdjustType("add");
    setAdjustQty(0);
    setAdjustReason("");
    setAdjustModalOpen(true);
  };

  const handleApplyAdjustment = () => {
    if (!adjustTarget || adjustQty <= 0) return;
    setStockData((prev) =>
      prev.map((s) =>
        s.id === adjustTarget.id
          ? {
              ...s,
              available: adjustType === "add" ? s.available + adjustQty : Math.max(0, s.available - adjustQty),
            }
          : s
      )
    );
    setAdjustModalOpen(false);
    message.success(`Stock ${adjustType === "add" ? "added" : "removed"}: ${adjustQty} units for ${adjustTarget.productName}`);
  };

  const stockColumns = [
    {
      title: "Product",
      key: "product",
      width: 250,
      render: (_: unknown, record: WarehouseStock) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{record.productName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>SKU: {record.sku}</Text>
        </div>
      ),
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse",
      key: "warehouse",
      width: 160,
      render: (w: string) => (
        <Space size={4}>
          <EnvironmentOutlined style={{ color: "#8c8c8c" }} />
          <Text style={{ fontSize: 13 }}>{w}</Text>
        </Space>
      ),
    },
    {
      title: "Available",
      dataIndex: "available",
      key: "available",
      width: 100,
      render: (val: number, record: WarehouseStock) => {
        const ratio = record.reorderPoint > 0 ? val / record.reorderPoint : 1;
        return (
          <Space orientation="vertical" size={2}>
            <Text strong style={{ fontSize: 13, color: val === 0 ? "#dc2626" : val <= record.reorderPoint ? "#d97706" : "#15803d" }}>
              {formatNumber(val)}
            </Text>
            <Progress
              percent={Math.min(100, ratio * 100)}
              size="small"
              showInfo={false}
              strokeColor={val === 0 ? "#dc2626" : val <= record.reorderPoint ? "#d97706" : "#15803d"}
              style={{ width: 60, margin: 0 }}
            />
          </Space>
        );
      },
      sorter: (a: WarehouseStock, b: WarehouseStock) => a.available - b.available,
    },
    {
      title: "Reserved",
      dataIndex: "reserved",
      key: "reserved",
      width: 90,
      render: (val: number) => <Text style={{ fontSize: 13 }}>{formatNumber(val)}</Text>,
    },
    {
      title: "Incoming",
      dataIndex: "incoming",
      key: "incoming",
      width: 90,
      render: (val: number) => (
        <Text style={{ fontSize: 13, color: val > 0 ? "#0f6fa8" : undefined }}>
          {val > 0 ? `+${formatNumber(val)}` : "-"}
        </Text>
      ),
    },
    {
      title: "Reorder Pt",
      dataIndex: "reorderPoint",
      key: "reorderPoint",
      width: 100,
      render: (val: number) => <Text type="secondary" style={{ fontSize: 13 }}>{formatNumber(val)}</Text>,
    },
    {
      title: "Velocity",
      dataIndex: "velocity",
      key: "velocity",
      width: 100,
      render: (val: number) => <Text style={{ fontSize: 13 }}>{val}/week</Text>,
      sorter: (a: WarehouseStock, b: WarehouseStock) => a.velocity - b.velocity,
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: WarehouseStock) => (
        <Button size="small" icon={<SwapOutlined />} onClick={() => handleAdjust(record)}>
          Adjust
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory Management"
        subtitle="Track stock levels, manage warehouses, and optimize reorder points"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => message.info("Syncing inventory...")}>
            Sync Inventory
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total SKUs" value={stats.totalSKUs} prefix={<ShopOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="In Stock" value={stats.inStock} valueStyle={{ color: "#15803d" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Low Stock" value={stats.lowStock} valueStyle={{ color: "#d97706" }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Out of Stock" value={stats.outOfStock} valueStyle={{ color: "#dc2626" }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Units" value={stats.totalUnits} prefix={<InboxOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Inventory Value" value={stats.totalValue} precision={0} prefix="$" />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
        items={[
          {
            key: "overview",
            label: (
              <span><InboxOutlined /> Stock Levels</span>
            ),
            children: (
              <>
                <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Input
                    placeholder="Search products or SKU..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 280, borderRadius: 8 }}
                    allowClear
                  />
                  <Select
                    placeholder="Filter by warehouse"
                    allowClear
                    value={warehouseFilter}
                    onChange={setWarehouseFilter}
                    style={{ width: 200 }}
                    options={warehouses.map((w) => ({ label: w, value: w }))}
                  />
                </div>
                <Table
                  dataSource={filteredStock}
                  columns={stockColumns}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 1000 }}
                  pagination={{ pageSize: 10, showTotal: (total) => `${total} records` }}
                />
              </>
            ),
          },
          {
            key: "alerts",
            label: (
              <span>
                <BellOutlined /> Alerts{" "}
                <Badge count={mockAlerts.filter((a) => a.severity === "critical").length} size="small" />
              </span>
            ),
            children: (
              <List
                dataSource={mockAlerts}
                renderItem={(alert) => (
                  <List.Item
                    actions={[
                      <Button size="small" type="primary" onClick={() => message.info(`Creating PO for ${alert.productName}`)}>
                        Reorder
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        alert.severity === "critical" ? (
                          <ExclamationCircleOutlined style={{ fontSize: 24, color: "#dc2626" }} />
                        ) : alert.severity === "warning" ? (
                          <WarningOutlined style={{ fontSize: 24, color: "#d97706" }} />
                        ) : (
                          <CheckCircleOutlined style={{ fontSize: 24, color: "#0f6fa8" }} />
                        )
                      }
                      title={
                        <Space>
                          <Text strong>{alert.productName}</Text>
                          <Tag color={alert.type === "out_of_stock" ? "red" : alert.type === "low_stock" ? "orange" : "blue"}>
                            {alert.type.replace(/_/g, " ").toUpperCase()}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space split={<Divider type="vertical" />}>
                          <Text type="secondary">SKU: {alert.sku}</Text>
                          <Text type="secondary">{alert.warehouse}</Text>
                          <Text type="secondary">
                            Current: {alert.currentStock} / Threshold: {alert.threshold}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ),
          },
          {
            key: "restock",
            label: (
              <span><ArrowUpOutlined /> Restock Suggestions</span>
            ),
            children: (
              <Table
                dataSource={restockSuggestions}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: "Product",
                    key: "product",
                    render: (_: unknown, r: typeof restockSuggestions[0]) => (
                      <div>
                        <Text strong style={{ fontSize: 13 }}>{r.productName}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>SKU: {r.sku}</Text>
                      </div>
                    ),
                  },
                  { title: "Warehouse", dataIndex: "warehouse", key: "warehouse" },
                  {
                    title: "Current Stock",
                    dataIndex: "available",
                    key: "available",
                    render: (v: number) => (
                      <Text style={{ color: v === 0 ? "#dc2626" : "#d97706", fontWeight: 500 }}>
                        {formatNumber(v)}
                      </Text>
                    ),
                  },
                  {
                    title: "Weeks to Stockout",
                    key: "weeks",
                    render: (_: unknown, r: typeof restockSuggestions[0]) => (
                      <Tag color={r.weeksUntilStockout <= 1 ? "red" : r.weeksUntilStockout <= 3 ? "orange" : "blue"}>
                        {r.weeksUntilStockout === Infinity ? "N/A" : `${r.weeksUntilStockout} weeks`}
                      </Tag>
                    ),
                    sorter: (a: typeof restockSuggestions[0], b: typeof restockSuggestions[0]) => a.weeksUntilStockout - b.weeksUntilStockout,
                  },
                  {
                    title: "Suggested Qty",
                    dataIndex: "suggestedQty",
                    key: "suggestedQty",
                    render: (v: number) => <Text strong>{formatNumber(v)}</Text>,
                  },
                  {
                    title: "Est. Cost",
                    dataIndex: "estimatedCost",
                    key: "estimatedCost",
                    render: (v: number) => formatCurrency(v),
                  },
                  {
                    title: "",
                    key: "action",
                    render: () => (
                      <Button size="small" type="primary" onClick={() => message.success("Purchase order created")}>
                        Create PO
                      </Button>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        title="Stock Adjustment"
        open={adjustModalOpen}
        onOk={handleApplyAdjustment}
        onCancel={() => setAdjustModalOpen(false)}
        okText="Apply Adjustment"
        okButtonProps={{ disabled: adjustQty <= 0 || !adjustReason }}
      >
        {adjustTarget && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Alert
              message={`${adjustTarget.productName} (${adjustTarget.sku})`}
              description={`Current stock: ${adjustTarget.available} at ${adjustTarget.warehouse}`}
              type="info"
              showIcon
            />
            <div>
              <Text strong style={{ display: "block", marginBottom: 8 }}>Adjustment Type</Text>
              <Radio.Group value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                <Radio.Button value="add">
                  <PlusOutlined /> Add Stock
                </Radio.Button>
                <Radio.Button value="remove">
                  <MinusOutlined /> Remove Stock
                </Radio.Button>
              </Radio.Group>
            </div>
            <div>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Quantity</Text>
              <InputNumber
                value={adjustQty}
                onChange={(v) => setAdjustQty(v || 0)}
                min={1}
                max={adjustType === "remove" ? adjustTarget.available : 99999}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Reason</Text>
              <Select
                value={adjustReason || undefined}
                onChange={setAdjustReason}
                placeholder="Select reason"
                style={{ width: "100%" }}
                options={[
                  { label: "Received shipment", value: "received_shipment" },
                  { label: "Returned inventory", value: "returned_inventory" },
                  { label: "Damaged goods", value: "damaged_goods" },
                  { label: "Cycle count correction", value: "cycle_count" },
                  { label: "Inventory audit", value: "audit" },
                  { label: "Theft/shrinkage", value: "shrinkage" },
                  { label: "Internal transfer", value: "transfer" },
                  { label: "Other", value: "other" },
                ]}
              />
            </div>
            {adjustQty > 0 && adjustReason && (
              <Alert
                message={`New stock will be: ${adjustType === "add" ? adjustTarget.available + adjustQty : Math.max(0, adjustTarget.available - adjustQty)}`}
                type={adjustType === "add" ? "success" : "warning"}
                showIcon
              />
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default InventoryDashboard;
