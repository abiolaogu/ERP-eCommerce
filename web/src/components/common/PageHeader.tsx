import React from "react";
import { Typography, Space, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  createButtonLabel?: string;
  createRoute?: string;
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  createButtonLabel,
  createRoute,
  extra,
}) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
      }}
    >
      <div>
        <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
          {title}
        </Title>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: "block" }}>
            {subtitle}
          </Text>
        )}
      </div>
      <Space>
        {extra}
        {createButtonLabel && createRoute && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(createRoute)}
            size="middle"
          >
            {createButtonLabel}
          </Button>
        )}
      </Space>
    </div>
  );
};
