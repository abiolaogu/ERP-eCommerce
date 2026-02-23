import React, { useState } from "react";
import { useList } from "@refinedev/core";
import { Table, Input, Select, Space, Button, Avatar, Tooltip, Typography } from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";
import { PRODUCT_STATUSES, PRODUCT_CATEGORIES } from "@/utils/constants";
import type { Product } from "@/types/ecommerce.types";

const { Text } = Typography;

const mockProducts: Product[] = [
  { id: "1", name: "Wireless Headphones Pro", sku: "WHP-001", description: "Premium noise-cancelling wireless headphones", price: 149.99, currency: "USD", category: "electronics", status: "active", stock: 342, images: [], createdAt: "2024-01-15T10:00:00Z" },
  { id: "2", name: "Organic Cotton T-Shirt", sku: "OCT-002", description: "100% organic cotton unisex t-shirt", price: 29.99, currency: "USD", category: "clothing", status: "active", stock: 1250, images: [], createdAt: "2024-02-01T08:00:00Z" },
  { id: "3", name: "Smart Watch Series 5", sku: "SWS-003", description: "Advanced fitness tracking smartwatch", price: 299.99, currency: "USD", category: "electronics", status: "active", stock: 89, images: [], createdAt: "2024-01-20T14:00:00Z" },
  { id: "4", name: "Running Shoes Ultra", sku: "RSU-004", description: "Lightweight performance running shoes", price: 119.99, currency: "USD", category: "sports", status: "active", stock: 567, images: [], createdAt: "2024-03-10T09:00:00Z" },
  { id: "5", name: "Portable Bluetooth Speaker", sku: "PBS-005", description: "Waterproof portable bluetooth speaker", price: 59.99, currency: "USD", category: "electronics", status: "active", stock: 890, images: [], createdAt: "2024-02-15T11:00:00Z" },
  { id: "6", name: "Leather Wallet Premium", sku: "LWP-006", description: "Genuine leather bifold wallet", price: 49.99, currency: "USD", category: "clothing", status: "draft", stock: 200, images: [], createdAt: "2024-04-01T13:00:00Z" },
  { id: "7", name: "Yoga Mat Professional", sku: "YMP-007", description: "Extra thick non-slip yoga mat", price: 39.99, currency: "USD", category: "sports", status: "active", stock: 430, images: [], createdAt: "2024-01-05T07:00:00Z" },
  { id: "8", name: "Stainless Steel Water Bottle", sku: "SSW-008", description: "Insulated stainless steel water bottle 32oz", price: 24.99, currency: "USD", category: "home-garden", status: "archived", stock: 0, images: [], createdAt: "2024-03-20T16:00:00Z" },
];

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  const { data, isLoading } = useList<Product>({
    resource: "products",
    pagination: { current: 1, pageSize: 50 },
  });

  const products = data?.data?.length ? data.data : mockProducts;

  const filteredData = products.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const columns = [
    {
      title: "Product",
      key: "product",
      render: (_: unknown, record: Product) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar
            shape="square"
            size={40}
            style={{
              backgroundColor: "#0f6fa815",
              color: "#0f6fa8",
              borderRadius: 8,
            }}
            icon={<ShopOutlined />}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{record.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              SKU: {record.sku}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (text: string) => (
        <span style={{ textTransform: "capitalize", fontSize: 13 }}>
          {text.replace(/-/g, " ")}
        </span>
      ),
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      render: (price: number, record: Product) => (
        <Text strong style={{ fontSize: 13 }}>
          {formatCurrency(price, record.currency)}
        </Text>
      ),
      sorter: (a: Product, b: Product) => a.price - b.price,
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (stock: number) => (
        <Text
          style={{
            fontSize: 13,
            color: stock === 0 ? "#dc2626" : stock < 100 ? "#d97706" : "#15803d",
            fontWeight: 500,
          }}
        >
          {formatNumber(stock)}
        </Text>
      ),
      sorter: (a: Product, b: Product) => a.stock - b.stock,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => (
        <Text style={{ fontSize: 13 }}>{formatDate(date)}</Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: Product) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/products/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog and inventory"
        createButtonLabel="Add Product"
        createRoute="/products/new"
      />

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
          placeholder="Filter by status"
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 180 }}
          options={PRODUCT_STATUSES.map((s) => ({ label: s.label, value: s.value }))}
        />
        <Select
          placeholder="Filter by category"
          allowClear
          value={categoryFilter}
          onChange={setCategoryFilter}
          style={{ width: 180 }}
          options={PRODUCT_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
        />
      </div>

      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `${total} products`,
        }}
      />
    </div>
  );
};

export default ProductList;
