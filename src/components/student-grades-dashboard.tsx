"use client";

import { useEffect, useState } from "react";
import { Empty, message, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

type Grade = {
  submissionId: string;
  assignmentTitle: string;
  final_score: number;
  feedback: string;
  teacherFeedback: string | null;
  published_at: string;
};

export function StudentGradesDashboard() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/student/grades");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "成绩加载失败");
        setGrades(result.grades);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "成绩加载失败");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const columns: ColumnsType<Grade> = [
    { title: "作业", dataIndex: "assignmentTitle" },
    { title: "最终成绩", dataIndex: "final_score", width: 120, render: (value) => <Tag color="green">{value} 分</Tag> },
    { title: "教师反馈", render: (_, row) => row.feedback || row.teacherFeedback || "无" },
    { title: "发布时间", dataIndex: "published_at", width: 180, render: (value) => new Date(value).toLocaleString("zh-CN") },
  ];
  return <section className="panel"><Table rowKey="submissionId" loading={loading} columns={columns} dataSource={grades} locale={{ emptyText: <Empty description="暂无已发布成绩" /> }} /></section>;
}
