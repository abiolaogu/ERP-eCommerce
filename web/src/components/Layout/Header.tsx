import React from "react";
import {
  Layout,
  Breadcrumb,
  Input,
  Badge,
  Avatar,
  Dropdown,
  Space,
  Typography,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const { Text } = Typography;

interface HeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

function generateBreadcrumbs(pathname: string): { title: React.ReactNode }[] {
  const crumbs: { title: React.ReactNode }[] = [
    { title: <Link to="/">Home</Link> },
  ];
  const segments = pathname.split("/").filter(Boolean);
  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    crumbs.push({ title: <Link to={path}>{label}</Link> });
  }
  return crumbs;
}

export const Header: React.FC<HeaderProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const breadcrumbItems = generateBreadcrumbs(location.pathname);

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Profile",
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
    },
    { type: "divider" as const },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "logout") {
      logout();
    }
  };

  return (
    <Layout.Header
      style={{
        background: "#fff",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        height: 64,
        lineHeight: "64px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          onClick={onToggle}
          style={{ cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center" }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </span>
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <Space size={20}>
        <Input
          placeholder="Search..."
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          style={{ width: 220, borderRadius: 8 }}
          allowClear
        />

        <Badge count={5} size="small">
          <BellOutlined style={{ fontSize: 18, cursor: "pointer", color: "#595959" }} />
        </Badge>

        <Dropdown
          menu={{ items: userMenuItems, onClick: handleMenuClick }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Space style={{ cursor: "pointer" }}>
            <Avatar
              size={32}
              src={user?.avatar}
              icon={<UserOutlined />}
              style={{ backgroundColor: "#0f6fa8" }}
            />
            <Text style={{ fontSize: 13, fontWeight: 500, maxWidth: 120 }} ellipsis>
              {user?.name || "User"}
            </Text>
          </Space>
        </Dropdown>
      </Space>
    </Layout.Header>
  );
};
