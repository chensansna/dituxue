"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, Form, Input, message } from "antd";
import { LockOutlined } from "@ant-design/icons";

export function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function submit(values: { password: string; confirm: string }) {
    if (values.password !== values.confirm) {
      message.error("两次输入的新密码不一致");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "修改失败");
      message.success("密码已更新");
      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "修改失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-page">
      <Card className="setup-card" title="首次登录修改密码">
        <p className="topbar-meta">为了账号安全，请先设置自己的新密码。</p>
        <Form layout="vertical" onFinish={(values) => void submit(values)}>
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 8, message: "新密码至少 8 位" }]}>
            <Input.Password size="large" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="confirm" label="确认新密码" rules={[{ required: true, message: "请再次输入新密码" }]}>
            <Input.Password size="large" prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>保存新密码</Button>
        </Form>
      </Card>
    </div>
  );
}
