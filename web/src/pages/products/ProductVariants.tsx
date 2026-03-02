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
  Checkbox,
  Tooltip,
  message,
  Popconfirm,
  Switch,
  Divider,
  Badge,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  AppstoreOutlined,
  CopyOutlined,
  DollarOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber } from "@/utils/formatters";

const { Text, Title } = Typography;

interface AttributeValue {
  id: string;
  value: string;
  colorHex?: string;
}

interface Attribute {
  id: string;
  name: string;
  values: AttributeValue[];
}

interface Variant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  status: "active" | "draft" | "out_of_stock";
  image?: string;
  weight?: number;
  barcode?: string;
}

const initialAttributes: Attribute[] = [
  {
    id: "attr-1",
    name: "Size",
    values: [
      { id: "s1", value: "XS" },
      { id: "s2", value: "S" },
      { id: "s3", value: "M" },
      { id: "s4", value: "L" },
      { id: "s5", value: "XL" },
    ],
  },
  {
    id: "attr-2",
    name: "Color",
    values: [
      { id: "c1", value: "Black", colorHex: "#000000" },
      { id: "c2", value: "White", colorHex: "#FFFFFF" },
      { id: "c3", value: "Navy", colorHex: "#001F3F" },
      { id: "c4", value: "Red", colorHex: "#DC2626" },
    ],
  },
  {
    id: "attr-3",
    name: "Material",
    values: [
      { id: "m1", value: "Cotton" },
      { id: "m2", value: "Polyester" },
    ],
  },
];

const generateVariants = (attributes: Attribute[]): Variant[] => {
  const activeAttrs = attributes.filter((a) => a.values.length > 0);
  if (activeAttrs.length === 0) return [];

  const combinations: Record<string, string>[][] = [[]];
  for (const attr of activeAttrs) {
    const newCombos: Record<string, string>[][] = [];
    for (const combo of combinations) {
      for (const val of attr.values) {
        newCombos.push([...combo, { [attr.name]: val.value }]);
      }
    }
    combinations.length = 0;
    combinations.push(...newCombos);
  }

  return combinations.slice(0, 40).map((combo, idx) => {
    const merged = combo.reduce((acc, c) => ({ ...acc, ...c }), {});
    const skuParts = Object.values(merged).map((v) =>
      v.substring(0, 3).toUpperCase()
    );
    return {
      id: `var-${idx + 1}`,
      sku: `PRD-${skuParts.join("-")}-${String(idx + 1).padStart(3, "0")}`,
      attributes: merged,
      price: 29.99 + Math.floor(Math.random() * 50),
      compareAtPrice: Math.random() > 0.5 ? 49.99 + Math.floor(Math.random() * 30) : undefined,
      stock: Math.floor(Math.random() * 500),
      status: Math.random() > 0.15 ? "active" : Math.random() > 0.5 ? "draft" : "out_of_stock",
      weight: 0.3 + Math.random() * 2,
    };
  });
};

const ProductVariants: React.FC = () => {
  const [attributes, setAttributes] = useState<Attribute[]>(initialAttributes);
  const [variants, setVariants] = useState<Variant[]>(() => generateVariants(initialAttributes));
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValues, setNewAttrValues] = useState("");
  const [bulkField, setBulkField] = useState<"price" | "stock">("price");
  const [bulkValue, setBulkValue] = useState<number>(0);

  const stats = useMemo(() => {
    const total = variants.length;
    const active = variants.filter((v) => v.status === "active").length;
    const outOfStock = variants.filter((v) => v.stock === 0 || v.status === "out_of_stock").length;
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const avgPrice = variants.length > 0 ? variants.reduce((sum, v) => sum + v.price, 0) / variants.length : 0;
    return { total, active, outOfStock, totalStock, avgPrice };
  }, [variants]);

  const handleRegenerateVariants = () => {
    const newVariants = generateVariants(attributes);
    setVariants(newVariants);
    setSelectedRowKeys([]);
    message.success(`Generated ${newVariants.length} variant combinations`);
  };

  const handleBulkUpdate = () => {
    setVariants((prev) =>
      prev.map((v) =>
        selectedRowKeys.includes(v.id)
          ? { ...v, [bulkField]: bulkValue }
          : v
      )
    );
    setBulkModalOpen(false);
    setSelectedRowKeys([]);
    message.success(`Updated ${selectedRowKeys.length} variants`);
  };

  const handleAddAttribute = () => {
    if (!newAttrName.trim() || !newAttrValues.trim()) return;
    const values = newAttrValues.split(",").map((v, i) => ({
      id: `new-${Date.now()}-${i}`,
      value: v.trim(),
    }));
    setAttributes((prev) => [
      ...prev,
      { id: `attr-${Date.now()}`, name: newAttrName.trim(), values },
    ]);
    setNewAttrName("");
    setNewAttrValues("");
    setAttrModalOpen(false);
    message.success(`Added attribute "${newAttrName.trim()}"`);
  };

  const handleRemoveAttribute = (attrId: string) => {
    setAttributes((prev) => prev.filter((a) => a.id !== attrId));
  };

  const handleRemoveAttrValue = (attrId: string, valueId: string) => {
    setAttributes((prev) =>
      prev.map((a) =>
        a.id === attrId
          ? { ...a, values: a.values.filter((v) => v.id !== valueId) }
          : a
      )
    );
  };

  const handleVariantFieldChange = (variantId: string, field: keyof Variant, value: unknown) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, [field]: value } : v))
    );
  };

  const statusIcon = (status: string) => {
    if (status === "active") return <CheckCircleOutlined />;
    if (status === "out_of_stock") return <CloseCircleOutlined />;
    return <SyncOutlined />;
  };

  const statusColor = (status: string) => {
    if (status === "active") return "success";
    if (status === "out_of_stock") return "error";
    return "default";
  };

  const columns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 200,
      render: (sku: string, record: Variant) =>
        editingVariant === record.id ? (
          <Input
            size="small"
            defaultValue={sku}
            onBlur={(e) => handleVariantFieldChange(record.id, "sku", e.target.value)}
            style={{ width: 170 }}
          />
        ) : (
          <Text code style={{ fontSize: 12 }}>{sku}</Text>
        ),
    },
    ...attributes.map((attr) => ({
      title: attr.name,
      key: attr.name,
      width: 100,
      render: (_: unknown, record: Variant) => {
        const val = record.attributes[attr.name];
        const attrDef = attr.values.find((v) => v.value === val);
        return (
          <Space size={4}>
            {attrDef?.colorHex && (
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: attrDef.colorHex,
                  border: "1px solid #d9d9d9",
                }}
              />
            )}
            <Text style={{ fontSize: 13 }}>{val || "-"}</Text>
          </Space>
        );
      },
    })),
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      width: 130,
      render: (price: number, record: Variant) =>
        editingVariant === record.id ? (
          <InputNumber
            size="small"
            defaultValue={price}
            min={0}
            prefix="$"
            onBlur={(e) => handleVariantFieldChange(record.id, "price", parseFloat(e.target.value) || price)}
            style={{ width: 100 }}
          />
        ) : (
          <Space orientation="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{formatCurrency(price)}</Text>
            {record.compareAtPrice && (
              <Text delete type="secondary" style={{ fontSize: 11 }}>
                {formatCurrency(record.compareAtPrice)}
              </Text>
            )}
          </Space>
        ),
      sorter: (a: Variant, b: Variant) => a.price - b.price,
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      width: 100,
      render: (stock: number, record: Variant) =>
        editingVariant === record.id ? (
          <InputNumber
            size="small"
            defaultValue={stock}
            min={0}
            onBlur={(e) => handleVariantFieldChange(record.id, "stock", parseInt(e.target.value) || 0)}
            style={{ width: 80 }}
          />
        ) : (
          <Text
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: stock === 0 ? "#dc2626" : stock < 20 ? "#d97706" : "#15803d",
            }}
          >
            {formatNumber(stock)}
          </Text>
        ),
      sorter: (a: Variant, b: Variant) => a.stock - b.stock,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string, record: Variant) =>
        editingVariant === record.id ? (
          <Select
            size="small"
            defaultValue={status}
            onChange={(val) => handleVariantFieldChange(record.id, "status", val)}
            style={{ width: 110 }}
            options={[
              { label: "Active", value: "active" },
              { label: "Draft", value: "draft" },
              { label: "Out of Stock", value: "out_of_stock" },
            ]}
          />
        ) : (
          <Tag color={statusColor(status)} icon={statusIcon(status)} style={{ borderRadius: 6 }}>
            {status === "out_of_stock" ? "Out of Stock" : status.charAt(0).toUpperCase() + status.slice(1)}
          </Tag>
        ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_: unknown, record: Variant) => (
        <Space size={4}>
          <Tooltip title={editingVariant === record.id ? "Save" : "Edit"}>
            <Button
              type="text"
              size="small"
              icon={editingVariant === record.id ? <SaveOutlined /> : <EditOutlined />}
              onClick={() => setEditingVariant(editingVariant === record.id ? null : record.id)}
            />
          </Tooltip>
          <Tooltip title="Duplicate">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                const dup = { ...record, id: `var-dup-${Date.now()}`, sku: `${record.sku}-COPY` };
                setVariants((prev) => [...prev, dup]);
                message.success("Variant duplicated");
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
        title="Product Variant Manager"
        subtitle="Create and manage product variants with attribute combinations"
        extra={
          <Space>
            <Button icon={<AppstoreOutlined />} onClick={handleRegenerateVariants}>
              Regenerate Variants
            </Button>
            {selectedRowKeys.length > 0 && (
              <Button type="primary" icon={<EditOutlined />} onClick={() => setBulkModalOpen(true)}>
                Bulk Update ({selectedRowKeys.length})
              </Button>
            )}
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Variants" value={stats.total} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Active" value={stats.active} valueStyle={{ color: "#15803d" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Out of Stock" value={stats.outOfStock} valueStyle={{ color: "#dc2626" }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total Stock" value={stats.totalStock} prefix={<InboxOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Avg Price" value={stats.avgPrice} precision={2} prefix={<DollarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Variant Attributes"
        style={{ marginBottom: 24 }}
        extra={
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAttrModalOpen(true)}>
            Add Attribute
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          {attributes.map((attr) => (
            <Col xs={24} md={8} key={attr.id}>
              <Card
                size="small"
                title={
                  <Space>
                    <Text strong>{attr.name}</Text>
                    <Badge count={attr.values.length} style={{ backgroundColor: "#0f6fa8" }} />
                  </Space>
                }
                extra={
                  <Popconfirm
                    title="Remove this attribute?"
                    onConfirm={() => handleRemoveAttribute(attr.id)}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                }
              >
                <Space wrap>
                  {attr.values.map((val) => (
                    <Tag
                      key={val.id}
                      closable
                      onClose={() => handleRemoveAttrValue(attr.id, val.id)}
                      style={{ borderRadius: 6, padding: "2px 8px" }}
                    >
                      {val.colorHex && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            backgroundColor: val.colorHex,
                            border: "1px solid #d9d9d9",
                            marginRight: 4,
                          }}
                        />
                      )}
                      {val.value}
                    </Tag>
                  ))}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={`Variant Combinations (${variants.length})`}>
        <Table
          dataSource={variants}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 900 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} variants`,
          }}
        />
      </Card>

      <Modal
        title="Add New Attribute"
        open={attrModalOpen}
        onOk={handleAddAttribute}
        onCancel={() => setAttrModalOpen(false)}
        okText="Add Attribute"
      >
        <Space orientation="vertical" style={{ width: "100%" }} size={16}>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Attribute Name</Text>
            <Input
              placeholder="e.g., Size, Color, Material"
              value={newAttrName}
              onChange={(e) => setNewAttrName(e.target.value)}
            />
          </div>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Values (comma-separated)</Text>
            <Input
              placeholder="e.g., Small, Medium, Large"
              value={newAttrValues}
              onChange={(e) => setNewAttrValues(e.target.value)}
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title="Bulk Update Variants"
        open={bulkModalOpen}
        onOk={handleBulkUpdate}
        onCancel={() => setBulkModalOpen(false)}
        okText="Apply to Selected"
      >
        <Space orientation="vertical" style={{ width: "100%" }} size={16}>
          <Text>
            Updating <Text strong>{selectedRowKeys.length}</Text> selected variants
          </Text>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Field to Update</Text>
            <Select
              value={bulkField}
              onChange={setBulkField}
              style={{ width: "100%" }}
              options={[
                { label: "Price", value: "price" },
                { label: "Stock", value: "stock" },
              ]}
            />
          </div>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>New Value</Text>
            <InputNumber
              value={bulkValue}
              onChange={(v) => setBulkValue(v || 0)}
              min={0}
              style={{ width: "100%" }}
              prefix={bulkField === "price" ? "$" : undefined}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default ProductVariants;
