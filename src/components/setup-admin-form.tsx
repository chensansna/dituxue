"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Form, Input, Result, Spin, message } from "antd";
import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";

type SetupState = "loading" | "available" | "closed";

export function SetupAdminForm() {
  const [state, setState] = useState<SetupState>("loading");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup")
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setState(result.available ? "available" : "closed");
      })
      .catch(() => {
        if (!cancelled) {
          message.error("初始化状态检查失败");
          setState("closed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(values: { email: string; displayName: string; password: string; confirm: string }) {
    if (values.password !== values.confirm) {
      message.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          displayName: values.displayName,
          password: values.password,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "创建管理员失败");
      setCreated(true);
      setState("closed");
      message.success("管理员创建成功，请返回登录");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建管理员失败");
    } finally {
      setLoading(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="setup-page">
        <Spin />
      </div>
    );
  }

  if (created) {
    return (
      <div className="setup-page">
        <Result
          status="success"
          title="首个管理员已创建"
          subTitle="现在可以回到登录页，用管理员邮箱和密码登录，然后创建教师账号。"
          extra={<Link href="/"><Button type="primary">返回登录</Button></Link>}
        />
      </div>
    );
  }

  if (state === "closed") {
    return (
      <div className="setup-page">
        <Result
          status="info"
          title="初始化入口已关闭"
          subTitle="系统已经存在管理员。后续教师账号请由管理员在后台创建。"
          extra={<Link href="/"><Button type="primary">返回登录</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="setup-page">
      <Card className="setup-card" title="初始化首个管理员">
        <Alert
          type="warning"
          showIcon
          message="这个页面只在系统没有管理员时可用"
          description="创建成功后，/setup 会自动关闭。请保存好管理员邮箱和密码。"
          style={{ marginBottom: 18 }}
        />
        <Form layout="vertical" onFinish={(values) => void submit(values)}>
          <Form.Item name="displayName" label="管理员姓名" rules={[{ required: true, message: "请输入管理员姓名" }]}>
            <Input size="large" prefix={<UserOutlined />} placeholder="例如：系统管理员" />
          </Form.Item>
          <Form.Item name="email" label="管理员邮箱" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}>
            <Input size="large" prefix={<MailOutlined />} placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item name="password" label="登录密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}>
            <Input.Password size="large" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="confirm" label="确认密码" rules={[{ required: true, message: "请再次输入密码" }]}>
            <Input.Password size="large" prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>创建管理员</Button>
        </Form>
      </Card>
    </div>
  );
}
