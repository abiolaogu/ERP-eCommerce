import React from "react";
import {
  DashboardOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import type { ResourceProps } from "@refinedev/core";

export const resources: ResourceProps[] = [
  {
    name: "dashboard",
    list: "/",
    meta: { label: "Dashboard", icon: <DashboardOutlined /> },
  },
  {
    name: "products",
    list: "/products",
    show: "/products/:id",
    create: "/products/new",
    meta: { icon: <ShopOutlined /> },
  },
  {
    name: "orders",
    list: "/orders",
    show: "/orders/:id",
    meta: { icon: <ShoppingCartOutlined /> },
  },
  {
    name: "customers",
    list: "/customers",
    show: "/customers/:id",
    meta: { icon: <UserOutlined /> },
  },
  {
    name: "analytics",
    list: "/analytics",
    meta: { icon: <BarChartOutlined /> },
  },
];
