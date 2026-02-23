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
const OrderList = lazy(() => import("./pages/orders/OrderList"));
const OrderShow = lazy(() => import("./pages/orders/OrderShow"));
const CustomerList = lazy(() => import("./pages/customers/CustomerList"));
const CustomerShow = lazy(() => import("./pages/customers/CustomerShow"));
const AnalyticsDashboard = lazy(() => import("./pages/analytics/AnalyticsDashboard"));
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
            <Route path="/orders" element={<OrderList />} />
            <Route path="/orders/:id" element={<OrderShow />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/:id" element={<CustomerShow />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Refine>
  );
}
