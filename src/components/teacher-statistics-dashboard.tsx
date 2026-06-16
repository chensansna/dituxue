"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, message, Progress, Select, Space, Table, Tag } from "antd";
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricGrid } from "./metric-grid";

type TeacherClass = { id: string; name: string; studentCount: number };
type TeacherAssignment = { id: string; title: string; classId: string; className: string };
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
type ScoreRecord = {
  studentId: string;
  studentNo: string;
  name: string;
  classId: string;
  className: string;
  assignmentId: string;
  assignmentTitle: string;
  score: number;
  publishedAt?: string | null;
};

type StatisticsPayload = {
  classes: TeacherClass[];
  assignments: TeacherAssignment[];
  ranked: RankedStudent[];
  scoreRecords: ScoreRecord[];
  summary: {
    classCount: number;
    studentCount: number;
    assignmentCount: number;
    averageScore: number | null;
    gradedStudentCount: number;
  };
};

type ChartMode = "distribution" | "assignmentAverage" | "classAverage";
type RankingRow = {
  id: string;
  rank: number;
  studentNo: string;
  name: string;
  className: string;
  score: number | null;
  submittedCount: number;
};

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function scoreBucket(score: number) {
  if (score >= 90) return "90-100";
  if (score >= 80) return "80-89";
  if (score >= 70) return "70-79";
  if (score >= 60) return "60-69";
  return "<60";
}

function downloadCsv(rows: RankingRow[], title: string) {
  const content = [
    ["排名", "学号", "姓名", "班级", "成绩", "提交次数"],
    ...rows.map((item) => [
      String(item.rank),
      item.studentNo,
      item.name,
      item.className,
      String(item.score ?? ""),
      String(item.submittedCount),
    ]),
  ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TeacherStatisticsDashboard() {
  const [data, setData] = useState<StatisticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [chartMode, setChartMode] = useState<ChartMode>("distribution");

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

  const assignmentOptions = useMemo(() => {
    const assignments = data?.assignments ?? [];
    return assignments
      .filter((item) => classFilter === "all" || item.classId === classFilter)
      .map((item) => ({ value: item.id, label: `${item.title} · ${item.className}` }));
  }, [data, classFilter]);

  const filteredScores = useMemo(() => {
    const records = data?.scoreRecords ?? [];
    return records.filter((item) => {
      const matchClass = classFilter === "all" || item.classId === classFilter;
      const matchAssignment = assignmentFilter === "all" || item.assignmentId === assignmentFilter;
      return matchClass && matchAssignment;
    });
  }, [data, classFilter, assignmentFilter]);

  const filteredStudents = useMemo(() => {
    const ranked = data?.ranked ?? [];
    return ranked.filter((item) => {
      const matchClass = classFilter === "all" || item.classId === classFilter;
      const matchQuery = !query || `${item.studentNo}${item.name}${item.className}`.includes(query);
      return matchClass && matchQuery;
    });
  }, [data, classFilter, query]);

  const rows = useMemo<RankingRow[]>(() => {
    const scoresByStudent = new Map<string, number[]>();
    const submitByStudent = new Map<string, number>();
    for (const record of filteredScores) {
      scoresByStudent.set(record.studentId, [...(scoresByStudent.get(record.studentId) ?? []), record.score]);
      submitByStudent.set(record.studentId, (submitByStudent.get(record.studentId) ?? 0) + 1);
    }

    return filteredStudents
      .map((student) => {
        const scopedScores = scoresByStudent.get(student.id);
        const score = scopedScores ? average(scopedScores) : assignmentFilter === "all" ? student.averageScore : null;
        return {
          id: student.id,
          rank: 0,
          studentNo: student.studentNo,
          name: student.name,
          className: student.className,
          score,
          submittedCount: assignmentFilter === "all" ? student.submittedCount : submitByStudent.get(student.id) ?? 0,
        };
      })
      .filter((item) => item.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [filteredScores, filteredStudents, assignmentFilter]);

  const chartData = useMemo(() => {
    if (chartMode === "assignmentAverage") {
      const byAssignment = new Map<string, { name: string; scores: number[] }>();
      for (const record of filteredScores) {
        const current = byAssignment.get(record.assignmentId) ?? { name: record.assignmentTitle, scores: [] };
        current.scores.push(record.score);
        byAssignment.set(record.assignmentId, current);
      }
      return [...byAssignment.values()].map((item) => ({ name: item.name, value: average(item.scores) ?? 0 }));
    }

    if (chartMode === "classAverage") {
      const byClass = new Map<string, { name: string; scores: number[] }>();
      for (const record of filteredScores) {
        const current = byClass.get(record.classId) ?? { name: record.className, scores: [] };
        current.scores.push(record.score);
        byClass.set(record.classId, current);
      }
      return [...byClass.values()].map((item) => ({ name: item.name, value: average(item.scores) ?? 0 }));
    }

    const buckets = ["90-100", "80-89", "70-79", "60-69", "<60"].map((name) => ({ name, value: 0 }));
    const bucketMap = new Map(buckets.map((item) => [item.name, item]));
    for (const record of filteredScores) {
      const bucket = bucketMap.get(scoreBucket(record.score));
      if (bucket) bucket.value += 1;
    }
    return buckets;
  }, [filteredScores, chartMode]);

  const columns: ColumnsType<RankingRow> = [
    { title: "排名", dataIndex: "rank", width: 80, render: (value) => <b>#{value}</b> },
    { title: "学号", dataIndex: "studentNo" },
    { title: "姓名", dataIndex: "name" },
    { title: "班级", dataIndex: "className" },
    { title: assignmentFilter === "all" ? "平均分" : "作业成绩", dataIndex: "score", render: (value) => value ?? "未评分" },
    { title: "提交次数", dataIndex: "submittedCount" },
    { title: "表现", render: (_, row) => <Progress percent={Math.round(row.score ?? 0)} size="small" strokeColor="#0f7a56" /> },
  ];

  const chartTitle = chartMode === "distribution" ? "成绩分布" : chartMode === "assignmentAverage" ? "作业平均分" : "班级平均分";
  const chartUnit = chartMode === "distribution" ? "人数" : "平均分";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>成绩统计</h1>
          <p>按班级和作业查看成绩分布、平均分和排名；数据来自 Supabase。</p>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv(rows, "grades")}>导出成绩</Button>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
        </Space>
      </div>

      <MetricGrid items={[
        { label: "班级数", value: data?.summary.classCount ?? 0, note: "当前教师名下" },
        { label: "学生数", value: data?.summary.studentCount ?? 0, note: "含未评分学生" },
        { label: "作业数", value: data?.summary.assignmentCount ?? 0, note: "已创建作业" },
        { label: "平均分", value: data?.summary.averageScore ?? "未评分", note: `${data?.summary.gradedStudentCount ?? 0} 名学生已有成绩` },
      ]} />

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head directory-toolbar stats-filter-bar">
          <Select
            value={classFilter}
            onChange={(value) => {
              setClassFilter(value);
              setAssignmentFilter("all");
            }}
            options={[{ value: "all", label: "全部班级" }, ...(data?.classes ?? []).map((item) => ({ value: item.id, label: item.name }))]}
          />
          <Select
            value={assignmentFilter}
            onChange={setAssignmentFilter}
            options={[{ value: "all", label: "全部作业" }, ...assignmentOptions]}
          />
          <Select
            value={chartMode}
            onChange={setChartMode}
            options={[
              { value: "distribution", label: "分数段分布" },
              { value: "assignmentAverage", label: "按作业平均分" },
              { value: "classAverage", label: "按班级平均分" },
            ]}
          />
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">{chartTitle}</span>
            <Tag color="green">已筛选 {filteredScores.length} 条成绩</Tag>
          </div>
          <div className="panel-body stats-chart">
            {chartData.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} domain={chartMode === "distribution" ? undefined : [0, 100]} />
                  <Tooltip formatter={(value) => [`${value}`, chartUnit]} />
                  <Bar dataKey="value" name={chartUnit} fill="#0f7a56" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无符合筛选条件的成绩" />}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><span className="panel-title">班级概览</span></div>
          <div className="panel-body class-list">
            {(data?.classes ?? []).map((item) => (
              <button
                className={`class-card ${classFilter === item.id ? "active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => {
                  setClassFilter(item.id);
                  setAssignmentFilter("all");
                }}
              >
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
          <Tag color="blue">当前排名 {rows.length} 人</Tag>
        </div>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 8 }} />
      </section>
    </>
  );
}
