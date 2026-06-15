"use client";

import { useEffect, useState } from "react";
import { Button, Empty, message, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

type Version = {
  id: string;
  version_no: number;
  submitted_by_teacher: boolean;
  created_at: string;
  files: Array<{ id: string; original_name: string; mime_type: string; size_bytes: number }>;
  review_results: Array<{
    id: string;
    overall_suggestion: string;
    visible_to_student: boolean;
    confirmed_at: string | null;
    raw_result: { items?: Array<{ rubricId: string; present: boolean }> };
  }>;
};
type Submission = {
  id: string;
  status: string;
  current_version: number;
  returned_reason: string | null;
  assignments: { title: string } | Array<{ title: string }>;
  submission_versions: Version[];
};
const checkLabels: Record<string, string> = { north_arrow: "指北针", scale_bar: "比例尺", legend: "图例", coordinate_grid: "坐标格网" };

export function StudentSubmissionsDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/student/submissions");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "提交记录加载失败");
        setSubmissions(result.submissions);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "提交记录加载失败");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function openFile(fileId: string) {
    const response = await fetch(`/api/files/${fileId}/signed-url`);
    const result = await response.json();
    if (!response.ok) return message.error(result.error ?? "文件打开失败");
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const rows = submissions.flatMap((submission) => submission.submission_versions.map((version) => ({
    key: version.id,
    assignmentTitle: Array.isArray(submission.assignments) ? submission.assignments[0]?.title : submission.assignments?.title,
    status: submission.status,
    returnedReason: submission.returned_reason,
    ...version,
    file: version.files?.[0],
    review: version.review_results?.find((item) => item.visible_to_student),
  })));
  const columns: ColumnsType<(typeof rows)[number]> = [
    { title: "作业", dataIndex: "assignmentTitle" },
    { title: "版本", dataIndex: "version_no", width: 90, render: (value) => `第 ${value} 版` },
    { title: "提交方式", dataIndex: "submitted_by_teacher", width: 110, render: (value) => value ? "教师代交" : "学生提交" },
    { title: "上传时间", dataIndex: "created_at", width: 180, render: (value) => new Date(value).toLocaleString("zh-CN") },
    { title: "文件", render: (_, row) => row.file ? <Button type="link" onClick={() => void openFile(row.file.id)}>{row.file.original_name}</Button> : "上传未完成" },
    { title: "状态", dataIndex: "status", width: 120, render: (value) => <Tag>{value}</Tag> },
    {
      title: "形式审查",
      render: (_, row) => row.review ? (
        <div>
          <div>{row.review.overall_suggestion}</div>
          <div style={{ marginTop: 6 }}>
            {(row.review.raw_result?.items ?? []).map((item) => <Tag key={item.rubricId} color={item.present ? "green" : "red"}>{checkLabels[item.rubricId] ?? item.rubricId}：{item.present ? "有" : "无"}</Tag>)}
          </div>
        </div>
      ) : "教师尚未确认",
    },
  ];

  return <section className="panel"><Table rowKey="key" loading={loading} columns={columns} dataSource={rows} locale={{ emptyText: <Empty description="暂无提交记录" /> }} /></section>;
}
