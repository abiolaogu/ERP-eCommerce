import React, { useState } from "react";
import { useList } from "@refinedev/core";
import { Table, Input, Select, Space, Button, Tooltip, Avatar, Tag, Typography } from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  UserOutlined,
  MailOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";
import { CUSTOMER_SEGMENTS } from "@/utils/constants";
import type { Customer } from "@/types/ecommerce.types";

const { Text } = Typography;

const segmentColors: Record<string, string> = {
  vip: "gold",
  regular: "blue",
  new: "green",
  "at-risk": "orange",
  churned: "red",
};

const mockCustomers: Customer[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah.johnson@email.com", phone: "+1 (555) 123-4567", totalOrders: 28, totalSpent: 4523.50, segment: "vip", createdAt: "2023-06-15T10:00:00Z" },
  { id: "2", name: "Michael Chen", email: "michael.chen@email.com", phone: "+1 (555) 234-5678", totalOrders: 12, totalSpent: 1890.25, segment: "regular", createdAt: "2023-09-01T08:00:00Z" },
  { id: "3", name: "Emily Davis", email: "emily.davis@email.com", phone: "+1 (555) 345-6789", totalOrders: 45, totalSpent: 8920.00, segment: "vip", createdAt: "2023-01-20T14:00:00Z" },
  { id: "4", name: "James Wilson", email: "james.wilson@email.com", phone: "+1 (555) 456-7890", totalOrders: 3, totalSpent: 267.50, segment: "new", createdAt: "2024-02-10T09:00:00Z" },
  { id: "5", name: "Lisa Anderson", email: "lisa.anderson@email.com", phone: "+1 (555) 567-8901", totalOrders: 8, totalSpent: 1245.00, segment: "regular", createdAt: "2023-11-15T11:00:00Z" },
  { id: "6", name: "Robert Brown", email: "robert.brown@email.com", phone: "+1 (555) 678-9012", totalOrders: 1, totalSpent: 49.99, segment: "at-risk", createdAt: "2023-08-01T13:00:00Z" },
  { id: "7", name: "Maria Garcia", email: "maria.garcia@email.com", phone: "+1 (555) 789-0123", totalOrders: 19, totalSpent: 3150.75, segment: "vip", createdAt: "2023-04-05T07:00:00Z" },
  { id: "8", name: "David Kim", email: "david.kim@email.com", phone: "+1 (555) 890-1234", totalOrders: 2, totalSpent: 599.98, segment: "new", createdAt: "2024-03-01T16:00:00Z" },
];

const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string | undefined>();

  const { data, isLoading } = useList<Customer>({
    resource: "customers",
    pagination: { current: 1, pageSize: 50 },
  });

  const customers = data?.data?.length ? data.data : mockCustomers;

  const filteredData = customers.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.email.toLowerCase().includes(searchText.toLowerCase());
    const matchesSegment = !segmentFilter || item.segment === segmentFilter;
    return matchesSearch && matchesSegment;
  });

  const columns = [
    {
      title: "Customer",
      key: "customer",
      render: (_: unknown, record: Customer) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar
            size={36}
            style={{ backgroundColor: "#0f6fa8" }}
            icon={<UserOutlined />}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{record.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MailOutlined style={{ marginRight: 4 }} />
              {record.email}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      render: (phone: string) => <Text style={{ fontSize: 13 }}>{phone}</Text>,
    },
    {
      title: "Segment",
      dataIndex: "segment",
      key: "segment",
      render: (segment: string) => (
        <Tag
          color={segmentColors[segment] || "default"}
          style={{ borderRadius: 6, textTransform: "uppercase", fontSize: 11, fontWeight: 600 }}
        >
          {segment.replace(/-/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Orders",
      dataIndex: "totalOrders",
      key: "totalOrders",
      render: (count: number) => <Text style={{ fontSize: 13 }}>{formatNumber(count)}</Text>,
      sorter: (a: Customer, b: Customer) => a.totalOrders - b.totalOrders,
    },
    {
      title: "Total Spent",
      dataIndex: "totalSpent",
      key: "totalSpent",
      render: (spent: number) => (
        <Text strong style={{ fontSize: 13 }}>
          {formatCurrency(spent)}
        </Text>
      ),
      sorter: (a: Customer, b: Customer) => a.totalSpent - b.totalSpent,
    },
    {
      title: "Member Since",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => <Text style={{ fontSize: 13 }}>{formatDate(date)}</Text>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_: unknown, record: Customer) => (
        <Tooltip title="View Customer">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/customers/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage your customer base and view customer insights"
      />

      <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Input
          placeholder="Search by name or email..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 280, borderRadius: 8 }}
          allowClear
        />
        <Select
          placeholder="Filter by segment"
          allowClear
          value={segmentFilter}
          onChange={setSegmentFilter}
          style={{ width: 180 }}
          options={CUSTOMER_SEGMENTS.map((s) => ({ label: s.label, value: s.value }))}
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
          showTotal: (total) => `${total} customers`,
        }}
      />
    </div>
  );
};

export default CustomerList;
