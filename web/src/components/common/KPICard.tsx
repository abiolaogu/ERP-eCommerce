import React from "react";
import { Card, Statistic, Typography } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface KPICardProps {
  title: string;
  value: string | number;
  prefix?: React.ReactNode;
  suffix?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  color?: string;
  loading?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  prefix,
  suffix,
  change,
  changeLabel,
  icon,
  color = "#0f6fa8",
  loading = false,
}) => {
  const isPositive = change !== undefined && change >= 0;
  const changeColor = isPositive ? "#15803d" : "#dc2626";

  return (
    <Card
      loading={loading}
      style={{ borderRadius: 10, height: "100%" }}
      bodyStyle={{ padding: "20px 24px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, display: "block" }}>
            {title}
          </Text>
          <Statistic
            value={value}
            prefix={prefix}
            suffix={suffix}
            valueStyle={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e" }}
          />
          {change !== undefined && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
              {isPositive ? (
                <ArrowUpOutlined style={{ color: changeColor, fontSize: 12 }} />
              ) : (
                <ArrowDownOutlined style={{ color: changeColor, fontSize: 12 }} />
              )}
              <Text style={{ color: changeColor, fontSize: 13, fontWeight: 500 }}>
                {Math.abs(change)}%
              </Text>
              {changeLabel && (
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                  {changeLabel}
                </Text>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              backgroundColor: `${color}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              color,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
