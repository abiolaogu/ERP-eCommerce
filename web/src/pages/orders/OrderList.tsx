import React, { useState } from "react";
import { useList } from "@refinedev/core";
import { Table, Input, Select, Space, Button, Tooltip, DatePicker, Typography } from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/utils/constants";
import type { Order } from "@/types/ecommerce.types";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const mockOrders: Order[] = [
  { id: "1", orderNumber: "ORD-2024-0891", customerId: "c1", customerName: "Sarah Johnson", items: [{ productId: "p1", productName: "Wireless Headphones", quantity: 2, unitPrice: 149.99, total: 299.98 }], total: 299.98, currency: "USD", status: "pending", paymentStatus: "pending", createdAt: new Date(Date.now() - 120000).toISOString() },
  { id: "2", orderNumber: "ORD-2024-0890", customerId: "c2", customerName: "Michael Chen", items: [{ productId: "p2", productName: "Cotton T-Shirt", quantity: 3, unitPrice: 29.99, total: 89.97 }], total: 89.97, currency: "USD", status: "confirmed", paymentStatus: "paid", createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: "3", orderNumber: "ORD-2024-0889", customerId: "c3", customerName: "Emily Davis", items: [{ productId: "p3", productName: "Smart Watch", quantity: 1, unitPrice: 299.99, total: 299.99 }, { productId: "p5", productName: "Speaker", quantity: 1, unitPrice: 59.99, total: 59.99 }], total: 359.98, currency: "USD", status: "shipped", paymentStatus: "paid", createdAt: new Date(Date.now() - 600000).toISOString() },
  { id: "4", orderNumber: "ORD-2024-0888", customerId: "c4", customerName: "James Wilson", items: [{ productId: "p4", productName: "Running Shoes", quantity: 1, unitPrice: 119.99, total: 119.99 }], total: 119.99, currency: "USD", status: "delivered", paymentStatus: "paid", createdAt: new Date(Date.now() - 1200000).toISOString() },
  { id: "5", orderNumber: "ORD-2024-0887", customerId: "c5", customerName: "Lisa Anderson", items: [{ productId: "p1", productName: "Wireless Headphones", quantity: 1, unitPrice: 149.99, total: 149.99 }, { productId: "p7", productName: "Yoga Mat", quantity: 2, unitPrice: 39.99, total: 79.98 }], total: 229.97, currency: "USD", status: "confirmed", paymentStatus: "paid", createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "6", orderNumber: "ORD-2024-0886", customerId: "c6", customerName: "Robert Brown", items: [{ productId: "p6", productName: "Leather Wallet", quantity: 1, unitPrice: 49.99, total: 49.99 }], total: 49.99, currency: "USD", status: "cancelled", paymentStatus: "refunded", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "7", orderNumber: "ORD-2024-0885", customerId: "c7", customerName: "Maria Garcia", items: [{ productId: "p2", productName: "Cotton T-Shirt", quantity: 5, unitPrice: 29.99, total: 149.95 }], total: 149.95, currency: "USD", status: "shipped", paymentStatus: "paid", createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "8", orderNumber: "ORD-2024-0884", customerId: "c8", customerName: "David Kim", items: [{ productId: "p3", productName: "Smart Watch", quantity: 2, unitPrice: 299.99, total: 599.98 }], total: 599.98, currency: "USD", status: "pending", paymentStatus: "pending", createdAt: new Date(Date.now() - 10800000).toISOString() },
];

const OrderList: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [paymentFilter, setPaymentFilter] = useState<string | undefined>();

  const { data, isLoading } = useList<Order>({
    resource: "orders",
    pagination: { current: 1, pageSize: 50 },
  });

  const orders = data?.data?.length ? data.data : mockOrders;

  const filteredData = orders.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.orderNumber.toLowerCase().includes(searchText.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesPayment = !paymentFilter || item.paymentStatus === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const columns = [
    {
      title: "Order",
      dataIndex: "orderNumber",
      key: "orderNumber",
      render: (text: string) => (
        <Text strong style={{ fontSize: 13, color: "#0f6fa8" }}>
          #{text}
        </Text>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: "Items",
      key: "items",
      render: (_: unknown, record: Order) => (
        <Text style={{ fontSize: 13 }}>
          {record.items.length} item{record.items.length !== 1 ? "s" : ""}
        </Text>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (total: number, record: Order) => (
        <Text strong style={{ fontSize: 13 }}>
          {formatCurrency(total, record.currency)}
        </Text>
      ),
      sorter: (a: Order, b: Order) => a.total - b.total,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: "Payment",
      dataIndex: "paymentStatus",
      key: "paymentStatus",
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => (
        <Text style={{ fontSize: 12 }}>{formatDateTime(date)}</Text>
      ),
      sorter: (a: Order, b: Order) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: "descend" as const,
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_: unknown, record: Order) => (
        <Tooltip title="View Order">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Track and manage customer orders"
        extra={<Button icon={<DownloadOutlined />}>Export</Button>}
      />

      <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Input
          placeholder="Search orders or customers..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 280, borderRadius: 8 }}
          allowClear
        />
        <Select
          placeholder="Order status"
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 160 }}
          options={ORDER_STATUSES.map((s) => ({ label: s.label, value: s.value }))}
        />
        <Select
          placeholder="Payment status"
          allowClear
          value={paymentFilter}
          onChange={setPaymentFilter}
          style={{ width: 160 }}
          options={PAYMENT_STATUSES.map((s) => ({ label: s.label, value: s.value }))}
        />
        <RangePicker style={{ borderRadius: 8 }} />
      </div>

      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `${total} orders`,
        }}
      />
    </div>
  );
};

export default OrderList;
