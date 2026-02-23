import React from "react";
import { Menu, Typography } from "antd";
import {
  DashboardOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useRolePermissions } from "@/hooks/usePermissions";

const { Text } = Typography;

interface SidebarProps {
  collapsed: boolean;
}

const allMenuItems = [
  {
    key: "/",
    icon: <DashboardOutlined />,
    label: "Dashboard",
    roles: ["admin", "editor", "viewer"],
  },
  {
    key: "/products",
    icon: <ShopOutlined />,
    label: "Products",
    roles: ["admin", "editor", "viewer"],
  },
  {
    key: "/orders",
    icon: <ShoppingCartOutlined />,
    label: "Orders",
    roles: ["admin", "editor", "viewer"],
  },
  {
    key: "/customers",
    icon: <UserOutlined />,
    label: "Customers",
    roles: ["admin", "editor", "viewer"],
  },
  {
    key: "/analytics",
    icon: <BarChartOutlined />,
    label: "Analytics",
    roles: ["admin", "editor"],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useRolePermissions();

  const filteredItems = allMenuItems.filter((item) => item.roles.includes(role));

  const selectedKey = location.pathname === "/"
    ? "/"
    : "/" + location.pathname.split("/")[1];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "0" : "0 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0f6fa8, #0ea5a4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            eC
          </div>
          {!collapsed && (
            <Text strong style={{ color: "#fff", fontSize: 16 }}>
              ERP eCommerce
            </Text>
          )}
        </div>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={filteredItems.map((item) => ({
          key: item.key,
          icon: item.icon,
          label: item.label,
        }))}
        onClick={({ key }) => navigate(key)}
        style={{ borderRight: 0, marginTop: 8, flex: 1 }}
      />
    </div>
  );
};
