"use client";

import { useEffect, useState } from "react";
import { Button, Form, Input, message, Modal, Popconfirm, Space, Table, Tag } from "antd";
import { DownloadOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

type TeacherAccount = {
  id: string;
  email: string;
  displayName: string;
  disabledAt: string | null;
  createdAt: string;
};

type TeacherCredential = {
  email: string;
  displayName: string;
  password: string;
};

function downloadCredentials(credential: TeacherCredential) {
  const rows = [
    ["邮箱", "姓名", "初始密码"],
    [credential.email, credential.displayName, credential.password],
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "teacher-account.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminTeachersManager() {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [credential, setCredential] = useState<TeacherCredential | null>(null);
  const [form] = Form.useForm();

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/teachers");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "教师账号加载失败");
      setTeachers(result.teachers);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "教师账号加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createTeacher(values: { email: string; displayName: string }) {
    const response = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "教师账号创建失败");
      return;
    }
    setTeachers(result.teachers);
    setCredential(result.credential);
    form.resetFields();
    setOpen(false);
    message.success("教师账号已创建，初始密码只显示这一次");
  }

  async function disableTeacher(id: string) {
    const response = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "停用失败");
      return;
    }
    setTeachers(result.teachers);
    message.success("教师账号已停用");
  }

  const columns: ColumnsType<TeacherAccount> = [
    { title: "教师姓名", dataIndex: "displayName" },
    { title: "邮箱", dataIndex: "email" },
    {
      title: "状态",
      dataIndex: "disabledAt",
      width: 120,
      render: (value) => value ? <Tag color="red">已停用</Tag> : <Tag color="green">正常</Tag>,
    },
    { title: "创建时间", dataIndex: "createdAt", width: 180, render: (value) => new Date(value).toLocaleString("zh-CN") },
    {
      title: "操作",
      width: 120,
      render: (_, row) => (
        <Popconfirm title="确定停用这个教师账号吗？" okText="停用" cancelText="取消" onConfirm={() => void disableTeacher(row.id)} disabled={Boolean(row.disabledAt)}>
          <Button danger size="small" disabled={Boolean(row.disabledAt)}>停用</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>教师账号</h1>
          <p>管理员创建教师账号，初始密码只在创建后显示一次。</p>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>创建教师</Button>
        </Space>
      </div>

      <section className="panel">
        <Table rowKey="id" loading={loading} columns={columns} dataSource={teachers} pagination={{ pageSize: 8 }} />
      </section>

      <Modal title="创建教师账号" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="创建账号" cancelText="取消">
        <Form form={form} layout="vertical" onFinish={(values) => void createTeacher(values)}>
          <Form.Item name="displayName" label="教师姓名" rules={[{ required: true, message: "请输入教师姓名" }]}>
            <Input placeholder="例如：王老师" />
          </Form.Item>
          <Form.Item name="email" label="登录邮箱" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}>
            <Input placeholder="teacher@example.com" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="初始密码只显示这一次"
        open={Boolean(credential)}
        onCancel={() => setCredential(null)}
        footer={credential ? (
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => downloadCredentials(credential)}>导出 CSV</Button>
            <Button type="primary" onClick={() => setCredential(null)}>我已保存</Button>
          </Space>
        ) : null}
      >
        {credential && (
          <div className="credential-card">
            <p><b>教师：</b>{credential.displayName}</p>
            <p><b>邮箱：</b>{credential.email}</p>
            <p><b>初始密码：</b><code>{credential.password}</code></p>
            <p className="topbar-meta">请把邮箱和初始密码发给教师。教师首次登录后会被要求修改密码。</p>
          </div>
        )}
      </Modal>
    </>
  );
}
