"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Badge, Button, Empty, Layout, List, Menu, Popover, Space, Tag } from "antd";
import {
  ApartmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";

type AppNotification = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "info" | "warning" | "danger" | "success";
};

type RoleKey = "admin" | "teacher" | "student";

type ProfileSkin = {
  displayName: string;
  honorific: string;
};

const roleConfig = {
  teacher: {
    label: "教师端",
    name: "教师",
    items: [
      { key: "/teacher", icon: <DashboardOutlined />, label: <Link href="/teacher">教学概览</Link> },
      { key: "/teacher/assignments", icon: <BookOutlined />, label: <Link href="/teacher/assignments">作业管理</Link> },
      { key: "/teacher/review", icon: <AuditOutlined />, label: <Link href="/teacher/review">AI 审查与复评</Link> },
      { key: "/teacher/students", icon: <TeamOutlined />, label: <Link href="/teacher/students">班级与学生</Link> },
      { key: "/teacher/statistics", icon: <BarChartOutlined />, label: <Link href="/teacher/statistics">成绩统计</Link> },
      { key: "/teacher/settings", icon: <SettingOutlined />, label: <Link href="/teacher/settings">个人设置</Link> },
    ],
  },
  student: {
    label: "学生端",
    name: "学生",
    items: [
      { key: "/student", icon: <DashboardOutlined />, label: <Link href="/student">我的作业</Link> },
      { key: "/student/submissions", icon: <UploadOutlined />, label: <Link href="/student/submissions">提交记录</Link> },
      { key: "/student/grades", icon: <BarChartOutlined />, label: <Link href="/student/grades">成绩与反馈</Link> },
      { key: "/student/settings", icon: <SettingOutlined />, label: <Link href="/student/settings">个人设置</Link> },
    ],
  },
  admin: {
    label: "管理员端",
    name: "管理员",
    items: [
      { key: "/admin", icon: <DashboardOutlined />, label: <Link href="/admin">运行概览</Link> },
      { key: "/admin/users", icon: <UserOutlined />, label: <Link href="/admin/users">教师账号</Link> },
      { key: "/admin/ai-jobs", icon: <FileSearchOutlined />, label: <Link href="/admin/ai-jobs">AI 调用记录</Link> },
      { key: "/admin/settings", icon: <SettingOutlined />, label: <Link href="/admin/settings">系统设置</Link> },
    ],
  },
};

export function AppShell({
  role,
  children,
  title,
  subtitle,
  userName,
}: {
  role: RoleKey;
  children: React.ReactNode;
  title: string;
  subtitle: string;
  userName?: string;
}) {
  const pathname = usePathname();
  const config = roleConfig[role];
  const [profileSkin, setProfileSkin] = useState<ProfileSkin>({
    displayName: userName ?? config.name,
    honorific: "",
  });
  const displayName = profileSkin.displayName || userName || config.name;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const loadProfileSkin = useCallback(async () => {
    try {
      const response = await fetch("/api/profile/settings", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) return;
      const nextSkin: ProfileSkin = {
        displayName: result.profile.displayName ?? userName ?? config.name,
        honorific: result.profile.honorific ?? "",
      };
      setProfileSkin(nextSkin);
    } catch {
      // Cosmetic profile data should not block the workspace.
    }
  }, [config.name, userName]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProfileSkin(), 0);
    const listener = () => void loadProfileSkin();
    window.addEventListener("profile-settings-updated", listener);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("profile-settings-updated", listener);
    };
  }, [loadProfileSkin]);

  async function loadNotifications() {
    setNotificationLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const result = await response.json();
      if (response.ok) setNotifications(result.notifications ?? []);
    } finally {
      setNotificationLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const notificationPanel = (
    <div className="notification-panel">
      <div className="notification-head">
        <b>通知中心</b>
        <Button type="link" size="small" loading={notificationLoading} onClick={() => void loadNotifications()}>刷新</Button>
      </div>
      {notifications.length ? (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item className={`notification-item is-${item.tone}`}>
              <Link href={item.href} onClick={() => setNotificationOpen(false)}>
                <b>{item.title}</b>
                <p>{item.description}</p>
              </Link>
            </List.Item>
          )}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待处理事项" />
      )}
    </div>
  );

  return (
    <Layout className="app-shell">
      <Layout.Sider width={232} className="app-sider">
        <div className="brand">
          <div className="brand-mark"><ApartmentOutlined /></div>
          <div><div className="brand-title">地图学教学辅助系统</div><div className="brand-sub">{config.label}</div></div>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[pathname]} items={config.items} style={{ padding: "12px 8px", borderInlineEnd: 0 }} />
        <div style={{ position: "absolute", bottom: 18, left: 16, right: 16 }}>
          <Button ghost block icon={<LogoutOutlined />} onClick={() => void logout()}>退出登录</Button>
        </div>
      </Layout.Sider>
      <Layout className="app-main">
        <header className="topbar">
          <div><div className="topbar-title">{title}</div><div className="topbar-meta">{subtitle}</div></div>
          <Space size={16}>
            <Tag color="green">Qwen 服务正常</Tag>
            <Popover
              trigger="click"
              placement="bottomRight"
              open={notificationOpen}
              onOpenChange={(open) => {
                setNotificationOpen(open);
                if (open) void loadNotifications();
              }}
              content={notificationPanel}
            >
              <button className="notification-button" type="button" aria-label="打开通知中心">
                <Badge count={notifications.length} size="small">
                  <BellOutlined style={{ fontSize: 18 }} />
                </Badge>
              </button>
            </Popover>
            <Avatar style={{ background: "#176b4d" }}>{displayName.slice(0, 1)}</Avatar>
            <span className="topbar-meta">{profileSkin.honorific || displayName}</span>
          </Space>
        </header>
        <main className="content">{children}</main>
      </Layout>
    </Layout>
  );
}
