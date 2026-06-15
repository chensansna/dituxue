"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Form, Input, message, Modal, Popconfirm, Select, Space, Table, Tag } from "antd";
import { DeleteOutlined, DownloadOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { MetricGrid } from "./metric-grid";

type TeacherClass = {
  id: string;
  name: string;
  term: string;
  studentCount: number;
  createdAt: string;
};

type TeacherStudent = {
  id: string;
  studentNo: string;
  name: string;
  classId: string;
  className: string;
  state: string;
  submittedCount: number;
  averageScore: number | null;
  createdAt: string;
};

type Credential = { studentNo: string; name: string; password: string };

function parseRoster(text: string, classId: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\s,，,]+/).filter(Boolean);
      return { classId, studentNo: parts[0] ?? "", name: parts.slice(1).join(" ") };
    })
    .filter((item) => item.studentNo && item.name);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function TeacherStudentsManager() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [classOpen, setClassOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selectedStudentKeys, setSelectedStudentKeys] = useState<React.Key[]>([]);
  const [classForm] = Form.useForm();
  const [studentForm] = Form.useForm();
  const [importForm] = Form.useForm();

  async function load() {
    setLoading(true);
    try {
      const [classResponse, studentResponse] = await Promise.all([fetch("/api/teacher/classes"), fetch("/api/teacher/students")]);
      const classResult = await classResponse.json();
      const studentResult = await studentResponse.json();
      if (!classResponse.ok) throw new Error(classResult.error ?? "班级加载失败");
      if (!studentResponse.ok) throw new Error(studentResult.error ?? "学生加载失败");
      setClasses(classResult.classes);
      setStudents(studentResult.students);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchClass = classFilter === "all" || student.classId === classFilter;
      const matchQuery = !query || `${student.studentNo}${student.name}${student.className}${student.state}`.includes(query);
      return matchClass && matchQuery;
    });
  }, [students, classFilter, query]);

  async function createClass() {
    const values = await classForm.validateFields();
    const response = await fetch("/api/teacher/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "创建班级失败");
      return;
    }
    setClasses(result.classes);
    classForm.resetFields();
    setClassOpen(false);
    message.success("班级已保存到 Supabase");
  }

  async function createStudent(values: { classId: string; studentNo: string; name: string }) {
    const response = await fetch("/api/teacher/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "添加学生失败");
      return;
    }
    setStudents(result.students);
    setCredentials(result.credentials);
    studentForm.resetFields();
    setStudentOpen(false);
    message.success("学生账号已创建");
  }

  async function importStudents() {
    const values = await importForm.validateFields();
    const roster = parseRoster(values.roster, values.classId);
    if (!roster.length) {
      message.warning("请按“学号 姓名”格式粘贴名单");
      return;
    }
    const response = await fetch("/api/teacher/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roster),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "导入失败");
      return;
    }
    setStudents(result.students);
    setCredentials(result.credentials);
    importForm.resetFields();
    setImportOpen(false);
    message.success(`已导入 ${result.credentials.length} 名学生`);
  }

  async function disableStudent(id: string) {
    const response = await fetch("/api/teacher/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "停用失败");
      return;
    }
    setStudents(result.students);
    message.success("学生已停用");
  }

  async function deleteStudents() {
    const selected = students.filter((student) => selectedStudentKeys.includes(`${student.classId}-${student.id}`));
    const response = await fetch("/api/teacher/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: selected.map((student) => ({ id: student.id, classId: student.classId })) }),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "删除学生失败");
      return;
    }
    setStudents(result.students);
    setSelectedStudentKeys([]);
    await load();
    message.success(`已从班级中删除 ${selected.length} 名学生，历史记录仍保留`);
  }

  async function deleteClass(id: string) {
    const response = await fetch("/api/teacher/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok) {
      message.error(result.error ?? "删除班级失败");
      return;
    }
    setClasses(result.classes);
    setClassFilter("all");
    message.success("班级已删除，历史数据仍保留");
  }

  const columns: ColumnsType<TeacherStudent> = [
    { title: "学号", dataIndex: "studentNo" },
    { title: "姓名", dataIndex: "name" },
    { title: "班级", dataIndex: "className" },
    { title: "提交次数", dataIndex: "submittedCount", width: 100 },
    { title: "平均分", dataIndex: "averageScore", width: 100, render: (value) => value ?? "未评分" },
    { title: "状态", dataIndex: "state", width: 100, render: (value) => <Tag color={value === "正常" ? "green" : "red"}>{value}</Tag> },
    { title: "操作", width: 110, render: (_, row) => <Button danger size="small" onClick={() => void disableStudent(row.id)} disabled={row.state !== "正常"}>停用</Button> },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>班级与学生</h1>
          <p>数据已保存到 Supabase；刷新页面或换设备后仍会保留。</p>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv("students.csv", [["学号", "姓名", "班级", "状态", "提交次数", "平均分"], ...filteredStudents.map((student) => [student.studentNo, student.name, student.className, student.state, String(student.submittedCount), String(student.averageScore ?? "")])])}>导出学生</Button>
          <Button icon={<UserAddOutlined />} onClick={() => setImportOpen(true)}>批量导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setStudentOpen(true)}>添加学生</Button>
        </Space>
      </div>

      <MetricGrid items={[
        { label: "班级数", value: classes.length, note: "Supabase 实时读取" },
        { label: "学生数", value: students.length, note: `${filteredStudents.length} 人符合筛选` },
        { label: "已停用", value: students.filter((student) => student.state !== "正常").length, note: "停用后不可作为有效账号" },
        { label: "已评分学生", value: students.filter((student) => student.averageScore !== null).length, note: "来自成绩表" },
      ]} />

      <div className="directory-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title"><TeamOutlined /> 班级管理</span>
            <Button size="small" type="primary" onClick={() => setClassOpen(true)}>新建班级</Button>
          </div>
          <div className="panel-body class-list">
            {classes.map((item) => (
              <div className={`class-card ${classFilter === item.id ? "active" : ""}`} key={item.id}>
                <button className="class-card-select" type="button" onClick={() => setClassFilter(item.id)}>
                  <b>{item.name}</b>
                  <span>{item.term}</span>
                  <Tag>{item.studentCount} 人</Tag>
                </button>
                <Popconfirm title={`删除班级“${item.name}”？`} description="删除前必须先删除班级内学生，历史作业和成绩仍保留。" okText="删除" cancelText="取消" onConfirm={() => void deleteClass(item.id)}>
                  <Button danger size="small" icon={<DeleteOutlined />}>删除班级</Button>
                </Popconfirm>
              </div>
            ))}
            {!classes.length && <Empty description="暂无班级" />}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head directory-toolbar">
            <Input prefix={<SearchOutlined />} placeholder="搜索姓名、学号或状态" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
            <Select value={classFilter} onChange={setClassFilter} options={[{ value: "all", label: "全部班级" }, ...classes.map((item) => ({ value: item.id, label: item.name }))]} />
            <Popconfirm title="删除所选学生？" description="学生将移出所选班级，历史提交和成绩仍会保留。" okText="删除" cancelText="取消" onConfirm={() => void deleteStudents()}>
              <Button danger icon={<DeleteOutlined />} disabled={!selectedStudentKeys.length}>删除所选学生</Button>
            </Popconfirm>
          </div>
          <Table
            rowKey={(row) => `${row.classId}-${row.id}`}
            rowSelection={{ selectedRowKeys: selectedStudentKeys, onChange: setSelectedStudentKeys }}
            loading={loading}
            columns={columns}
            dataSource={filteredStudents}
            pagination={{ pageSize: 8 }}
          />
        </section>
      </div>

      <Modal title="新建班级" open={classOpen} onCancel={() => setClassOpen(false)} onOk={() => void createClass()} okText="保存班级" cancelText="取消">
        <Form form={classForm} layout="vertical" initialValues={{ term: "2025-2026 第二学期" }}>
          <Form.Item name="name" label="班级名称" rules={[{ required: true, message: "请输入班级名称" }]}><Input placeholder="例如：地图学 2024-1班" /></Form.Item>
          <Form.Item name="term" label="学期"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="添加学生" open={studentOpen} onCancel={() => setStudentOpen(false)} onOk={() => studentForm.submit()} okText="创建账号" cancelText="取消">
        <Form form={studentForm} layout="vertical" onFinish={(values) => void createStudent(values)} initialValues={{ classId: classes[0]?.id }}>
          <Form.Item name="classId" label="班级" rules={[{ required: true, message: "请选择班级" }]}><Select options={classes.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="studentNo" label="学号" rules={[{ required: true, message: "请输入学号" }]}><Input /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="批量导入学生" open={importOpen} onCancel={() => setImportOpen(false)} onOk={() => void importStudents()} okText="确认导入" cancelText="取消">
        <Form form={importForm} layout="vertical" initialValues={{ classId: classFilter === "all" ? classes[0]?.id : classFilter }}>
          <Form.Item name="classId" label="导入到班级" rules={[{ required: true, message: "请选择班级" }]}><Select options={classes.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="roster" label="粘贴名单" rules={[{ required: true, message: "请粘贴名单" }]}>
            <Input.TextArea rows={8} placeholder={"每行一个学生，例如：\n20260001 张一\n20260002 张二"} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="初始密码仅显示这一次"
        open={credentials.length > 0}
        onCancel={() => setCredentials([])}
        footer={(
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => downloadCsv("student-accounts.csv", [["学号", "姓名", "初始密码"], ...credentials.map((item) => [item.studentNo, item.name, item.password])])}
            >
              导出 CSV
            </Button>
            <Button type="primary" onClick={() => setCredentials([])}>我已保存</Button>
          </Space>
        )}
      >
        <Table size="small" rowKey="studentNo" pagination={false} dataSource={credentials} columns={[{ title: "学号", dataIndex: "studentNo" }, { title: "姓名", dataIndex: "name" }, { title: "初始密码", dataIndex: "password" }]} />
      </Modal>
    </>
  );
}
