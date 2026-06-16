"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, message, Progress, Space, Tag, Upload } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, UploadOutlined } from "@ant-design/icons";
import { uploadSubmissionFile } from "@/lib/submission-upload";
import { MetricGrid } from "./metric-grid";

type StudentAssignment = {
  id: string;
  title: string;
  description: string;
  className: string;
  deadline: string;
  extensionReason: string | null;
  canSubmit: boolean;
  submission: { status: string; returned_reason: string | null; teacher_feedback: string | null; current_version: number } | null;
  grade: { final_score: number; feedback: string; published_at: string } | null;
};

const statusLabels: Record<string, string> = {
  ai_processing: "上传处理中",
  ai_failed: "AI 审查失败",
  pending_teacher_review: "待教师复评",
  returned: "待修改",
  reviewed: "复评完成",
  graded: "已评分",
};

export function StudentDashboard() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/student/assignments");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "作业加载失败");
      setAssignments(result.assignments);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "作业加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function upload(assignment: StudentAssignment, file: File) {
    setLoadingId(assignment.id);
    try {
      await uploadSubmissionFile(assignment.id, file);
      message.success("地图已上传，等待教师进行形式审查");
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setLoadingId(null);
    }
  }

  const returned = assignments.filter((item) => item.submission?.status === "returned").length;
  const pending = assignments.filter((item) => item.canSubmit && !item.submission).length;
  const completed = assignments.filter((item) => item.grade).length;
  const average = useMemo(() => {
    const grades = assignments.flatMap((item) => item.grade ? [Number(item.grade.final_score)] : []);
    return grades.length ? Math.round(grades.reduce((sum, score) => sum + score, 0) / grades.length * 10) / 10 : "未评分";
  }, [assignments]);

  return (
    <>
      <div className="page-head"><div><h1>我的地图学作业</h1><p>查看作业、上传地图、修改退回稿和查看已发布成绩。</p></div></div>
      <MetricGrid items={[
        { label: "待提交", value: pending, note: "尚未上传的作业" },
        { label: "待修改", value: returned, note: "教师已退回" },
        { label: "已评分", value: completed, note: "已发布成绩" },
        { label: "平均成绩", value: average, note: "仅计算已发布成绩" },
      ]} />
      {returned > 0 && <Alert message={`有 ${returned} 份作业被退回修改`} description="请查看教师退回原因，并上传新的地图版本。" type="warning" showIcon style={{ marginBottom: 18 }} />}
      <section className="panel">
        <div className="panel-head"><span className="panel-title">可见作业</span><Tag color="green">Supabase 真实数据</Tag></div>
        <div className="panel-body">
          {loading && <Progress percent={40} status="active" showInfo={false} />}
          {!loading && !assignments.length && <Empty description="当前没有已发布作业" />}
          {assignments.map((assignment) => {
            const state = assignment.grade ? "已评分" : assignment.submission ? statusLabels[assignment.submission.status] ?? assignment.submission.status : assignment.canSubmit ? "可提交" : "已截止";
            const canUpload = assignment.canSubmit && (!assignment.submission || assignment.submission.status === "returned");
            return (
              <div className="review-item" key={assignment.id}>
                <div className="review-title">
                  <span>{assignment.grade ? <CheckCircleOutlined /> : <ClockCircleOutlined />} &nbsp;{assignment.title}</span>
                  <Tag color={assignment.submission?.status === "returned" ? "orange" : assignment.grade ? "green" : "blue"}>{state}</Tag>
                </div>
                <div className="review-copy">
                  {assignment.className} · 截止 {new Date(assignment.deadline).toLocaleString("zh-CN")}<br />
                  {assignment.submission?.status === "returned"
                    ? assignment.submission.returned_reason || assignment.submission.teacher_feedback || "教师已退回，请按形式审查结果修改后重新提交。"
                    : assignment.submission?.teacher_feedback || assignment.description || "请按要求提交地图文件。"}
                </div>
                {assignment.extensionReason && <Tag color="gold" style={{ marginTop: 8 }}>个人延期：{assignment.extensionReason}</Tag>}
                <Space style={{ marginTop: 12 }}>
                  {canUpload && (
                    <Upload
                      accept=".png,.jpg,.jpeg,.pdf"
                      showUploadList={false}
                      beforeUpload={(file) => {
                        void upload(assignment, file);
                        return false;
                      }}
                    >
                      <Button type={assignment.submission?.status === "returned" ? "primary" : "default"} loading={loadingId === assignment.id} icon={<UploadOutlined />}>
                        {assignment.submission?.status === "returned" ? "上传修改稿" : "上传作业"}
                      </Button>
                    </Upload>
                  )}
                </Space>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
