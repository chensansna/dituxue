"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, DatePicker, Form, Input, message, Modal, Popconfirm, Progress, Select, Space, Table, Tag } from "antd";
import { DeleteOutlined, DownloadOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { MetricGrid } from "./metric-grid";

type TeacherClass = { id: string; name: string; term: string; studentCount: number };
type TeacherAssignment = {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  status: "draft" | "published" | "closed" | "archived";
  deadline: string;
  submittedCount: number;
  gradedCount: number;
  createdAt: string;
};

function statusLabel(status: TeacherAssignment["status"]) {
  return { draft: "草稿", published: "已发布", closed: "已截止", archived: "已归档" }[status];
}

function downloadCsv(rows: TeacherAssignment[]) {
  const content = [
    ["作业", "班级", "状态", "截止时间", "提交数", "已评分"],
    ...rows.map((item) => [item.title, item.className, statusLabel(item.status), item.deadline, String(item.submittedCount), String(item.gradedCount)]),
  ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "assignments.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function TeacherAssignmentsManager() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [noDeadline, setNoDeadline] = useState(false);
  const [query, setQuery] = useState("");
  const [form] = Form.useForm();

  async function load() {
    setLoading(true);
    try {
      const [classResponse, assignmentResponse] = await Promise.all([fetch("/api/teacher/classes"), fetch("/api/teacher/assignments")]);
      const classResult = await classResponse.json();
      const assignmentResult = await assignmentResponse.json();
      if (!classResponse.ok) throw new Error(classResult.error ?? "班级加载失败");
      if (!assignmentResponse.ok) throw new Error(assignmentResult.error ?? "作业加载失败");
      setClasses(classResult.classes);
      setAssignments(assignmentResult.assignments);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => assignments.filter((item) => `${item.title}${item.className}${statusLabel(item.status)}`.includes(query)), [assignments, query]);

  async function submit() {
    const values = await form.validateFields();
    const response = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description,
        classIds: values.classIds,
        status: values.status,
        deadline: noDeadline ? null : values.deadline?.toISOString(),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "创建作业失败");
      return;
    }
    setAssignments(result.assignments);
    setOpen(false);
    setNoDeadline(false);
    form.resetFields();
    message.success("作业已保存到 Supabase");
  }

  async function deleteAssignment(id: string) {
    const response = await fetch("/api/teacher/assignments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "删除作业失败");
      return;
    }
    setAssignments(result.assignments);
    message.success("作业已删除，历史提交和成绩仍保留");
  }

  const columns: ColumnsType<TeacherAssignment> = [
    { title: "作业", dataIndex: "title", render: (value, row) => <div><b>{value}</b><div className="topbar-meta">{row.description || "无任务说明"}</div></div> },
    { title: "班级", dataIndex: "className", width: 180 },
    { title: "截止时间", dataIndex: "deadline", width: 180, render: (value) => value.startsWith("2099") ? "无截止日期" : new Date(value).toLocaleString("zh-CN") },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <Tag color={value === "published" ? "green" : "default"}>{statusLabel(value)}</Tag> },
    { title: "提交", width: 130, render: (_, row) => `${row.submittedCount} 份` },
    { title: "评分进度", width: 180, render: (_, row) => <Progress size="small" percent={row.submittedCount ? Math.round(row.gradedCount / row.submittedCount * 100) : 0} strokeColor="#176b4d" /> },
    { title: "操作", width: 100, render: (_, row) => <Popconfirm title={`删除作业“${row.title}”？`} description="学生端将不再显示，历史提交、审查和成绩仍保留。" okText="删除" cancelText="取消" onConfirm={() => void deleteAssignment(row.id)}><Button danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>作业管理</h1>
          <p>创建、发布和管理地图学作业；数据保存到 Supabase。</p>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv(filtered)}>导出作业</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>创建作业</Button>
        </Space>
      </div>

      <MetricGrid items={[
        { label: "作业总数", value: assignments.length, note: "当前教师工作台" },
        { label: "已发布", value: assignments.filter((item) => item.status === "published").length, note: "学生可见" },
        { label: "提交总数", value: assignments.reduce((sum, item) => sum + item.submittedCount, 0), note: "来自提交记录" },
        { label: "已评分", value: assignments.reduce((sum, item) => sum + item.gradedCount, 0), note: "来自成绩表" },
      ]} />

      <section className="panel">
        <div className="panel-head">
          <Input prefix={<SearchOutlined />} placeholder="搜索作业或班级" value={query} onChange={(event) => setQuery(event.target.value)} allowClear style={{ maxWidth: 360 }} />
          <Tag color="green">Supabase 已连接</Tag>
        </div>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={filtered} pagination={{ pageSize: 8 }} />
      </section>

      <Modal title="创建地图学作业" open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="创建作业" cancelText="取消">
        <Form form={form} layout="vertical" initialValues={{ status: "published", classIds: classes[0] ? [classes[0].id] : [] }}>
          <Form.Item name="title" label="作业标题" rules={[{ required: true, message: "请输入作业标题" }]}><Input placeholder="例如：专题地图设计" /></Form.Item>
          <Form.Item name="classIds" label="发布班级" rules={[{ required: true, message: "请选择班级" }]}><Select mode="multiple" options={classes.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item label="截止时间" required={!noDeadline}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Form.Item name="deadline" noStyle rules={[{ validator: (_, value) => noDeadline || value ? Promise.resolve() : Promise.reject(new Error("请选择截止时间或勾选无截止日期")) }]}>
                <DatePicker showTime disabled={noDeadline} style={{ width: "100%" }} placeholder={noDeadline ? "无截止日期" : "请选择截止时间"} />
              </Form.Item>
              <Checkbox checked={noDeadline} onChange={(event) => { setNoDeadline(event.target.checked); if (event.target.checked) form.setFieldValue("deadline", null); }}>无截止日期</Checkbox>
            </Space>
          </Form.Item>
          <Form.Item name="description" label="任务说明 / AI评分要求"><Input.TextArea rows={4} placeholder="例如：绘制江苏省边界图，要求省界清晰、城市或主要要素表达完整，并包含图例、比例尺、指北针和坐标格网。" /></Form.Item>
          <Form.Item name="status" label="创建后状态"><Select options={[{ value: "published", label: "立即发布" }, { value: "draft", label: "保存为草稿" }]} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
