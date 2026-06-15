import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import "./globals.css";

dayjs.locale("zh-cn");

export const metadata: Metadata = {
  title: "基于LLM的地图学教学辅助系统",
  description: "地图作业提交、AI形式审查与教师复评平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#176b4d", borderRadius: 10, colorText: "#17221d", fontFamily: '"Microsoft YaHei","PingFang SC",Arial,sans-serif' }, components: { Menu: { darkItemBg: "#102b21", darkItemSelectedBg: "#246b50" }, Table: { headerBg: "#f6f8f7" } } }}>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
