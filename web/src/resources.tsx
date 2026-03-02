import React from "react";
import {
  DashboardOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  InboxOutlined,
  GiftOutlined,
  StarOutlined,
  GlobalOutlined,
  ShoppingOutlined,
  TeamOutlined,
  SyncOutlined,
  CarOutlined,
  RollbackOutlined,
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
    name: "product-variants",
    list: "/products/variants",
    meta: { label: "Product Variants", icon: <AppstoreOutlined />, parent: "products" },
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
    name: "customer-segments",
    list: "/customers/segments",
    meta: { label: "Customer Segments", icon: <TeamOutlined />, parent: "customers" },
  },
  {
    name: "inventory",
    list: "/inventory",
    meta: { label: "Inventory", icon: <InboxOutlined /> },
  },
  {
    name: "promotions",
    list: "/promotions",
    meta: { label: "Promotions", icon: <GiftOutlined /> },
  },
  {
    name: "reviews",
    list: "/reviews",
    meta: { label: "Reviews", icon: <StarOutlined /> },
  },
  {
    name: "channels",
    list: "/channels",
    meta: { label: "Channels", icon: <GlobalOutlined /> },
  },
  {
    name: "abandoned-carts",
    list: "/abandoned-carts",
    meta: { label: "Abandoned Carts", icon: <ShoppingOutlined /> },
  },
  {
    name: "subscriptions",
    list: "/subscriptions",
    meta: { label: "Subscriptions", icon: <SyncOutlined /> },
  },
  {
    name: "shipping",
    list: "/shipping",
    meta: { label: "Shipping", icon: <CarOutlined /> },
  },
  {
    name: "returns",
    list: "/returns",
    meta: { label: "Returns", icon: <RollbackOutlined /> },
  },
  {
    name: "analytics",
    list: "/analytics",
    meta: { icon: <BarChartOutlined /> },
  },
];
