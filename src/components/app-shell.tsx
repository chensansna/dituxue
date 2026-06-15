"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Badge, Button, Layout, Menu, Space, Tag } from "antd";
import { ApartmentOutlined, AuditOutlined, BarChartOutlined, BellOutlined, BookOutlined, DashboardOutlined, FileSearchOutlined, LogoutOutlined, SettingOutlined, TeamOutlined, UploadOutlined, UserOutlined } from "@ant-design/icons";

const roleConfig = {
  teacher: {
    label: "教师端",
    name: "王静怡老师",
    items: [
      { key: "/teacher", icon: <DashboardOutlined />, label: <Link href="/teacher">教学概览</Link> },
      { key: "/teacher/assignments", icon: <BookOutlined />, label: <Link href="/teacher/assignments">作业管理</Link> },
      { key: "/teacher/review", icon: <AuditOutlined />, label: <Link href="/teacher/review">AI 审查与复评</Link> },
      { key: "/teacher/students", icon: <TeamOutlined />, label: <Link href="/teacher/students">班级与学生</Link> },
      { key: "/teacher/statistics", icon: <BarChartOutlined />, label: <Link href="/teacher/statistics">成绩统计</Link> },
    ],
  },
  student: {
    label: "学生端",
    name: "林晓雨",
    items: [
      { key: "/student", icon: <DashboardOutlined />, label: <Link href="/student">我的作业</Link> },
      { key: "/student/submissions", icon: <UploadOutlined />, label: <Link href="/student/submissions">提交记录</Link> },
      { key: "/student/grades", icon: <BarChartOutlined />, label: <Link href="/student/grades">成绩与反馈</Link> },
    ],
  },
  admin: {
    label: "管理员端",
    name: "系统管理员",
    items: [
      { key: "/admin", icon: <DashboardOutlined />, label: <Link href="/admin">运行概览</Link> },
      { key: "/admin/users", icon: <UserOutlined />, label: <Link href="/admin/users">教师账号</Link> },
      { key: "/admin/ai-jobs", icon: <FileSearchOutlined />, label: <Link href="/admin/ai-jobs">AI 调用记录</Link> },
      { key: "/admin/settings", icon: <SettingOutlined />, label: <Link href="/admin/settings">系统设置</Link> },
    ],
  },
};

export function AppShell({ role, children, title, subtitle }: { role: keyof typeof roleConfig; children: React.ReactNode; title: string; subtitle: string }) {
  const pathname = usePathname();
  const config = roleConfig[role];
  return (
    <Layout className="app-shell">
      <Layout.Sider width={232} className="app-sider">
        <div className="brand"><div className="brand-mark"><ApartmentOutlined /></div><div><div className="brand-title">地图学教学辅助系统</div><div className="brand-sub">{config.label}</div></div></div>
        <Menu theme="dark" mode="inline" selectedKeys={[pathname]} items={config.items} style={{ padding: "12px 8px", borderInlineEnd: 0 }} />
        <div style={{ position: "absolute", bottom: 18, left: 16, right: 16 }}><Link href="/"><Button ghost block icon={<LogoutOutlined />}>切换角色</Button></Link></div>
      </Layout.Sider>
      <Layout className="app-main">
        <header className="topbar">
          <div><div className="topbar-title">{title}</div><div className="topbar-meta">{subtitle}</div></div>
          <Space size={16}><Tag color="green">Qwen 服务正常</Tag><Badge dot><BellOutlined style={{ fontSize: 18 }} /></Badge><Avatar style={{ background: "#176b4d" }}>{config.name.slice(0, 1)}</Avatar><span className="topbar-meta">{config.name}</span></Space>
        </header>
        <main className="content">{children}</main>
      </Layout>
    </Layout>
  );
}
