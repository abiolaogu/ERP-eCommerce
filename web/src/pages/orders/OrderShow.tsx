import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Descriptions,
  Table,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Steps,
  Divider,
  Tag,
  Timeline,
} from "antd";
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CarOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import type { OrderItem } from "@/types/ecommerce.types";

const { Title, Text } = Typography;

const mockOrder = {
  id: "1",
  orderNumber: "ORD-2024-0891",
  customerId: "c1",
  customerName: "Sarah Johnson",
  customerEmail: "sarah.johnson@email.com",
  customerPhone: "+1 (555) 123-4567",
  items: [
    { productId: "p1", productName: "Wireless Headphones Pro", quantity: 2, unitPrice: 149.99, total: 299.98 },
    { productId: "p5", productName: "Portable Bluetooth Speaker", quantity: 1, unitPrice: 59.99, total: 59.99 },
  ],
  total: 359.97,
  subtotal: 339.97,
  tax: 20.00,
  shipping: 0,
  currency: "USD",
  status: "shipped" as const,
  paymentStatus: "paid" as const,
  paymentMethod: "Credit Card (****4242)",
  shippingAddress: "123 Main Street, Apt 4B, New York, NY 10001",
  shippingMethod: "Express Delivery",
  trackingNumber: "TRK-2024-ABC123",
  createdAt: new Date(Date.now() - 600000).toISOString(),
};

const orderTimeline = [
  { time: new Date(Date.now() - 600000).toISOString(), action: "Order placed", detail: "Customer placed order online" },
  { time: new Date(Date.now() - 480000).toISOString(), action: "Payment confirmed", detail: "Payment of $359.97 received via credit card" },
  { time: new Date(Date.now() - 360000).toISOString(), action: "Order confirmed", detail: "Order confirmed and sent to warehouse" },
  { time: new Date(Date.now() - 240000).toISOString(), action: "Packed", detail: "Items packed and ready for shipping" },
  { time: new Date(Date.now() - 120000).toISOString(), action: "Shipped", detail: "Package handed to carrier. Tracking: TRK-2024-ABC123" },
];

const statusStepMap: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  shipped: 2,
  delivered: 3,
  cancelled: -1,
};

const OrderShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = { ...mockOrder, id: id || "1" };

  const currentStep = statusStepMap[order.status] ?? 0;

  const itemColumns = [
    {
      title: "Product",
      dataIndex: "productName",
      key: "productName",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "center" as const,
    },
    {
      title: "Unit Price",
      dataIndex: "unitPrice",
      key: "unitPrice",
      render: (price: number) => formatCurrency(price, order.currency),
      align: "right" as const,
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (total: number) => (
        <Text strong>{formatCurrency(total, order.currency)}</Text>
      ),
      align: "right" as const,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/orders")}
          style={{ marginBottom: 8, padding: 0 }}
        >
          Back to Orders
        </Button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Order #{order.orderNumber}
            </Title>
            <Text type="secondary">Placed {formatDateTime(order.createdAt)}</Text>
          </div>
          <Space>
            <Button icon={<PrinterOutlined />}>Print Invoice</Button>
          </Space>
        </div>
      </div>

      {(order.status as string) !== "cancelled" && (
        <Card style={{ borderRadius: 10, marginBottom: 16 }}>
          <Steps
            current={currentStep}
            items={[
              { title: "Pending", icon: <ClockCircleOutlined /> },
              { title: "Confirmed", icon: <CheckCircleOutlined /> },
              { title: "Shipped", icon: <CarOutlined /> },
              { title: "Delivered", icon: <InboxOutlined /> },
            ]}
          />
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={16}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Order Items</Title>}
            style={{ borderRadius: 10 }}
          >
            <Table
              dataSource={order.items}
              columns={itemColumns}
              rowKey="productId"
              pagination={false}
              size="middle"
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <Text type="secondary">Subtotal</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      {formatCurrency(order.subtotal, order.currency)}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <Text type="secondary">Tax</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      {formatCurrency(order.tax, order.currency)}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <Text type="secondary">Shipping</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      {order.shipping === 0 ? "Free" : formatCurrency(order.shipping, order.currency)}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <Text strong style={{ fontSize: 16 }}>Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: "#0f6fa8" }}>
                        {formatCurrency(order.total, order.currency)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card title="Customer" style={{ borderRadius: 10 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Name">
                  <Text strong>{order.customerName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Email">{order.customerEmail}</Descriptions.Item>
                <Descriptions.Item label="Phone">{order.customerPhone}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Payment" style={{ borderRadius: 10 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Status">
                  <StatusBadge status={order.paymentStatus} />
                </Descriptions.Item>
                <Descriptions.Item label="Method">{order.paymentMethod}</Descriptions.Item>
                <Descriptions.Item label="Amount">
                  <Text strong>{formatCurrency(order.total, order.currency)}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Shipping" style={{ borderRadius: 10 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Method">{order.shippingMethod}</Descriptions.Item>
                <Descriptions.Item label="Address">{order.shippingAddress}</Descriptions.Item>
                {order.trackingNumber && (
                  <Descriptions.Item label="Tracking">
                    <Text copyable>{order.trackingNumber}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Space>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Order Timeline</Title>}
        style={{ borderRadius: 10 }}
      >
        <Timeline
          items={orderTimeline.map((event) => ({
            dot: <CheckCircleOutlined style={{ color: "#15803d" }} />,
            children: (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text strong style={{ fontSize: 13 }}>{event.action}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(event.time)}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{event.detail}</Text>
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
};

export default OrderShow;
