"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, message, Progress, Select, Space, Table, Tag } from "antd";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricGrid } from "./metric-grid";

type TeacherClass = { id: string; name: string; studentCount: number };
type RankedStudent = {
  id: string;
  studentNo: string;
  name: string;
  classId: string;
  className: string;
  state: string;
  submittedCount: number;
  averageScore: number | null;
  rank: number;
};

type StatisticsPayload = {
  classes: TeacherClass[];
  ranked: RankedStudent[];
  summary: {
    classCount: number;
    studentCount: number;
    assignmentCount: number;
    averageScore: number | null;
    gradedStudentCount: number;
  };
};

function downloadCsv(rows: RankedStudent[]) {
  const content = [
    ["排名", "学号", "姓名", "班级", "平均分", "提交次数"],
    ...rows.map((item) => [String(item.rank), item.studentNo, item.name, item.className, String(item.averageScore ?? ""), String(item.submittedCount)]),
  ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "grades.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function TeacherStatisticsDashboard() {
  const [data, setData] = useState<StatisticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/teacher/statistics");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "成绩统计加载失败");
      setData(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成绩统计加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const rows = useMemo(() => {
    const ranked = data?.ranked ?? [];
    return ranked.filter((item) => {
      const matchClass = classFilter === "all" || item.classId === classFilter;
      const matchQuery = !query || `${item.studentNo}${item.name}${item.className}`.includes(query);
      return matchClass && matchQuery;
    });
  }, [data, classFilter, query]);

  const chartData = useMemo(() => {
    const buckets = [
      { name: "90-100", count: 0 },
      { name: "80-89", count: 0 },
      { name: "70-79", count: 0 },
      { name: "60-69", count: 0 },
      { name: "<60", count: 0 },
    ];
    for (const student of rows) {
      const score = student.averageScore ?? 0;
      if (score >= 90) buckets[0].count += 1;
      else if (score >= 80) buckets[1].count += 1;
      else if (score >= 70) buckets[2].count += 1;
      else if (score >= 60) buckets[3].count += 1;
      else buckets[4].count += 1;
    }
    return buckets;
  }, [rows]);

  const columns: ColumnsType<RankedStudent> = [
    { title: "排名", dataIndex: "rank", width: 80, render: (value) => <b>#{value}</b> },
    { title: "学号", dataIndex: "studentNo" },
    { title: "姓名", dataIndex: "name" },
    { title: "班级", dataIndex: "className" },
    { title: "平均分", dataIndex: "averageScore", render: (value) => value ?? "未评分" },
    { title: "提交次数", dataIndex: "submittedCount" },
    { title: "表现", render: (_, row) => <Progress percent={Math.round(row.averageScore ?? 0)} size="small" strokeColor="#176b4d" /> },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>成绩统计</h1>
          <p>查看成绩分布、排名并导出教学结果；数据来自 Supabase。</p>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv(rows)}>导出成绩</Button>
          <Button onClick={() => void load()}>刷新</Button>
        </Space>
      </div>

      <MetricGrid items={[
        { label: "班级数", value: data?.summary.classCount ?? 0, note: "当前教师名下" },
        { label: "学生数", value: data?.summary.studentCount ?? 0, note: "含未评分学生" },
        { label: "作业数", value: data?.summary.assignmentCount ?? 0, note: "已创建作业" },
        { label: "平均分", value: data?.summary.averageScore ?? "未评分", note: `${data?.summary.gradedStudentCount ?? 0} 名学生已有成绩` },
      ]} />

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">成绩分布</span>
            <Tag color="green">Supabase 已连接</Tag>
          </div>
          <div className="panel-body stats-chart">
            {rows.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="学生数" fill="#176b4d" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无已发布成绩" />}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><span className="panel-title">班级概览</span></div>
          <div className="panel-body class-list">
            {(data?.classes ?? []).map((item) => (
              <button className={`class-card ${classFilter === item.id ? "active" : ""}`} key={item.id} type="button" onClick={() => setClassFilter(item.id)}>
                <b>{item.name}</b>
                <span>{item.studentCount} 名学生</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head directory-toolbar">
          <Input prefix={<SearchOutlined />} placeholder="搜索姓名或学号" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
          <Select value={classFilter} onChange={setClassFilter} options={[{ value: "all", label: "全部班级" }, ...(data?.classes ?? []).map((item) => ({ value: item.id, label: item.name }))]} />
        </div>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 8 }} />
      </section>
    </>
  );
}
