export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  status: "active" | "draft" | "archived";
  stock: number;
  images: string[];
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  total: number;
  currency: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "refunded";
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  segment: string;
  createdAt: string;
}

export interface AnalyticsMetrics {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  conversionRate: number;
  topProducts: { name: string; revenue: number }[];
}
