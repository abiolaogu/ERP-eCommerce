import type { ThemeConfig } from "antd";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#0f6fa8",
    colorSuccess: "#15803d",
    colorWarning: "#d97706",
    colorError: "#dc2626",
    colorBgLayout: "#f0f5ff",
    borderRadius: 10,
    fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
    fontSize: 14,
    colorLink: "#0f6fa8",
    colorLinkHover: "#0ea5a4",
  },
  components: {
    Layout: {
      siderBg: "#001529",
      headerBg: "#ffffff",
      bodyBg: "#f0f5ff",
    },
    Menu: {
      darkItemBg: "#001529",
      darkSubMenuItemBg: "#000c17",
      darkItemSelectedBg: "#0f6fa8",
      darkItemHoverBg: "rgba(15, 111, 168, 0.4)",
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Card: {
      borderRadiusLG: 10,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Table: {
      borderRadius: 10,
      headerBg: "#fafbfc",
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
  },
};
