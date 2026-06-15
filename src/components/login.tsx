"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Form, Input, Segmented, message } from "antd";
import { ApartmentOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";

type LoginMode = "staff" | "student";

export function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>("staff");
  const [loading, setLoading] = useState(false);

  async function login(values: { identifier: string; password: string }) {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "登录失败");
      message.success("登录成功");
      router.replace(result.redirectTo);
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="brand" style={{ padding: 0, border: 0 }}>
          <div className="brand-mark"><ApartmentOutlined /></div>
          <div><div className="brand-title">基于 LLM 的地图学教学辅助系统</div><div className="brand-sub">Qwen AI 驱动的形式审查与教学反馈</div></div>
        </div>
        <div>
          <h1>让地图形式审查更高效，让教学反馈更有依据。</h1>
          <p>统一管理班级、地图作业、AI 审查、人工复评与成绩发布。账号权限由 Supabase Auth 与行级权限共同保护。</p>
        </div>
        <div style={{ color: "#83ad99", fontSize: 12 }}>线上 Qwen API · Supabase 私有存储 · 角色权限隔离</div>
      </section>
      <section className="login-form-wrap">
        <div className="login-form">
          <h2>登录教学系统</h2>
          <p className="topbar-meta">教师和管理员使用邮箱登录；学生使用教师发放的学号和初始密码登录。</p>
          {searchParams.get("error") === "disabled" && <Alert type="error" showIcon message="账号已停用，请联系管理员。" style={{ marginTop: 16 }} />}
          <Segmented
            block
            value={mode}
            onChange={(value) => setMode(value as LoginMode)}
            options={[{ label: "教师 / 管理员", value: "staff" }, { label: "学生", value: "student" }]}
            style={{ margin: "22px 0" }}
          />
          <Form layout="vertical" onFinish={(values) => void login(values)}>
            <Form.Item name="identifier" label={mode === "student" ? "学号" : "邮箱"} rules={[{ required: true, message: mode === "student" ? "请输入学号" : "请输入邮箱" }]}>
              <Input size="large" prefix={<UserOutlined />} placeholder={mode === "student" ? "例如：20260001" : "例如：teacher@example.com"} />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="请输入密码" />
            </Form.Item>
            <Button htmlType="submit" type="primary" size="large" block loading={loading}>登录</Button>
          </Form>
          <div className="topbar-meta" style={{ marginTop: 16 }}>
            首次部署？请先进入 <Link href="/setup" style={{ color: "#176b4d", fontWeight: 700 }}>初始化管理员</Link>。
          </div>
        </div>
      </section>
    </div>
  );
}
