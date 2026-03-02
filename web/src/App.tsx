import React, { lazy, Suspense } from "react";
import { Refine, Authenticated } from "@refinedev/core";
import { Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";
import { authProvider } from "./authProvider";
import { dataProvider } from "./dataProvider";
import { resources } from "./resources";
import { MainLayout } from "./components/Layout/MainLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductList = lazy(() => import("./pages/products/ProductList"));
const ProductShow = lazy(() => import("./pages/products/ProductShow"));
const ProductCreate = lazy(() => import("./pages/products/ProductCreate"));
const ProductVariants = lazy(() => import("./pages/products/ProductVariants"));
const OrderList = lazy(() => import("./pages/orders/OrderList"));
const OrderShow = lazy(() => import("./pages/orders/OrderShow"));
const CustomerList = lazy(() => import("./pages/customers/CustomerList"));
const CustomerShow = lazy(() => import("./pages/customers/CustomerShow"));
const CustomerSegments = lazy(() => import("./pages/customers/CustomerSegments"));
const AnalyticsDashboard = lazy(() => import("./pages/analytics/AnalyticsDashboard"));
const InventoryDashboard = lazy(() => import("./pages/inventory/InventoryDashboard"));
const PromotionList = lazy(() => import("./pages/promotions/PromotionList"));
const ReviewList = lazy(() => import("./pages/reviews/ReviewList"));
const ChannelList = lazy(() => import("./pages/channels/ChannelList"));
const AbandonedCarts = lazy(() => import("./pages/carts/AbandonedCarts"));
const SubscriptionList = lazy(() => import("./pages/subscriptions/SubscriptionList"));
const ShippingDashboard = lazy(() => import("./pages/shipping/ShippingDashboard"));
const ReturnList = lazy(() => import("./pages/returns/ReturnList"));
const LoginPage = lazy(() => import("./pages/Login"));

const PageLoader: React.FC = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
    <Spin size="large" />
  </div>
);

export default function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      authProvider={authProvider}
      resources={resources}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        disableTelemetry: true,
      }}
    >
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <Authenticated key="main" fallback={<Navigate to="/login" />}>
                <MainLayout />
              </Authenticated>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/products/:id" element={<ProductShow />} />
            <Route path="/products/new" element={<ProductCreate />} />
            <Route path="/products/variants" element={<ProductVariants />} />
            <Route path="/orders" element={<OrderList />} />
            <Route path="/orders/:id" element={<OrderShow />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/:id" element={<CustomerShow />} />
            <Route path="/customers/segments" element={<CustomerSegments />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/inventory" element={<InventoryDashboard />} />
            <Route path="/promotions" element={<PromotionList />} />
            <Route path="/reviews" element={<ReviewList />} />
            <Route path="/channels" element={<ChannelList />} />
            <Route path="/abandoned-carts" element={<AbandonedCarts />} />
            <Route path="/subscriptions" element={<SubscriptionList />} />
            <Route path="/shipping" element={<ShippingDashboard />} />
            <Route path="/returns" element={<ReturnList />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Refine>
  );
}
