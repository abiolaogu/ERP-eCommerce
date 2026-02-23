import React from "react";
import { Tag } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
  ClockCircleOutlined,
  CarOutlined,
  InboxOutlined,
  DollarOutlined,
} from "@ant-design/icons";

type StatusVariant =
  | "active"
  | "inactive"
  | "draft"
  | "archived"
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "paid"
  | "refunded"
  | "success"
  | "error"
  | "processing";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
}

const statusConfig: Record<
  StatusVariant,
  { color: string; icon: React.ReactNode }
> = {
  active: { color: "success", icon: <CheckCircleOutlined /> },
  inactive: { color: "default", icon: <MinusCircleOutlined /> },
  draft: { color: "default", icon: <ClockCircleOutlined /> },
  archived: { color: "default", icon: <InboxOutlined /> },
  pending: { color: "processing", icon: <SyncOutlined spin /> },
  confirmed: { color: "blue", icon: <CheckCircleOutlined /> },
  shipped: { color: "cyan", icon: <CarOutlined /> },
  delivered: { color: "success", icon: <CheckCircleOutlined /> },
  cancelled: { color: "error", icon: <CloseCircleOutlined /> },
  paid: { color: "success", icon: <DollarOutlined /> },
  refunded: { color: "warning", icon: <ExclamationCircleOutlined /> },
  success: { color: "success", icon: <CheckCircleOutlined /> },
  error: { color: "error", icon: <CloseCircleOutlined /> },
  processing: { color: "processing", icon: <SyncOutlined spin /> },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant }) => {
  const key = (variant || status) as StatusVariant;
  const config = statusConfig[key] || { color: "default", icon: null };
  const displayLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Tag color={config.color} icon={config.icon} style={{ borderRadius: 6 }}>
      {displayLabel}
    </Tag>
  );
};
