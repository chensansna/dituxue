"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Input, InputNumber, message, Modal, Progress, Select, Space, Table, Tag } from "antd";
import { CheckCircleFilled, CloseCircleFilled, ReloadOutlined, SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { reviewResultSchema } from "@/lib/domain";
import type { z } from "zod";
import { MapFilePreview } from "./map-file-preview";

type ReviewResult = z.infer<typeof reviewResultSchema>;
type ReviewItem = ReviewResult["items"][number];
type QueueRow = {
  id: string;
  status: string;
  assignmentId: string;
  assignmentTitle: string;
  className: string;
  studentName: string;
  studentNo: string;
  fileName: string | null;
  hasReview: boolean;
};
type Version = {
  id: string;
  version_no: number;
  files: Array<{ id: string; original_name: string; mime_type: string; size_bytes: number }>;
  review_results: Array<{
    id: string;
    raw_result: ReviewResult;
    overall_suggestion: string;
    confidence: number;
    review_corrections: Array<{ check_key: string; teacher_value: ReviewItem }>;
  }>;
};

const checks = [
  { id: "north_arrow", title: "指北针", description: "检查地图中是否存在明确指北符号或北向标记" },
  { id: "scale_bar", title: "比例尺", description: "检查数字比例尺、文字比例尺或图解比例尺" },
  { id: "legend", title: "图例", description: "检查是否存在说明地图符号或颜色的图例" },
  { id: "coordinate_grid", title: "坐标格网", description: "检查格网线、经纬网线或坐标刻度标注" },
];

export function ReviewWorkspace() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState("请选择一条学生提交，然后点击 Qwen 形式审查。");
  const [confidence, setConfidence] = useState(0);
  const [teacherScore, setTeacherScore] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"draft" | "returned" | "reviewed" | "graded">("draft");
  const [teacherComment, setTeacherComment] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRows, setBatchRows] = useState<Array<QueueRow & { batchStatus: "pending" | "processing" | "completed" | "failed"; error?: string }>>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const selected = queue.find((item) => item.id === selectedId);
  const latest = versions.find((item) => item.version_no === currentVersion);
  const presentCount = items.filter((item) => item.present).length;

  async function loadQueue() {
    const response = await fetch("/api/teacher/review/queue");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "审查队列加载失败");
    setQueue(result.submissions);
    setSelectedId((current) => current && result.submissions.some((item: QueueRow) => item.id === current) ? current : result.submissions[0]?.id);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue().catch((error) => message.error(error.message)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => void loadDetail(selectedId), 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  async function loadDetail(submissionId: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/teacher/review/${submissionId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "提交详情加载失败");
      setVersions(result.versions);
      setCurrentVersion(result.submission.current_version);
      setTeacherScore(result.grade?.final_score ?? null);
      setTeacherComment(result.grade?.feedback ?? result.submission.teacher_feedback ?? "");
      setReviewStatus(result.submission.status === "returned" ? "returned" : result.submission.status === "reviewed" ? "reviewed" : result.submission.status === "graded" ? "graded" : "draft");
      const version = result.versions.find((item: Version) => item.version_no === result.submission.current_version);
      const review = version?.review_results?.[0];
      if (review) {
        const parsed = reviewResultSchema.parse(review.raw_result);
        const corrected = parsed.items.map((item) => review.review_corrections?.find((entry: { check_key: string }) => entry.check_key === item.rubricId)?.teacher_value ?? item);
        setItems(corrected);
        setSummary(review.overall_suggestion);
        setConfidence(Number(review.confidence));
      } else {
        setItems([]);
        setSummary("当前版本尚未完成形式审查。");
        setConfidence(0);
      }
      const file = version?.files?.[0];
      if (file) {
        const signed = await fetch(`/api/files/${file.id}/signed-url`);
        const signedResult = await signed.json();
        if (signed.ok) setPreview(signedResult);
      } else {
        setPreview(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交详情加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function runReview(submissionId = selectedId) {
    if (!submissionId) return;
    setReviewing(true);
    try {
      const response = await fetch(`/api/teacher/review/${submissionId}/run-ai`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Qwen 审查失败");
      if (submissionId === selectedId) {
        const parsed = reviewResultSchema.parse(result);
        setItems(parsed.items);
        setSummary(parsed.summary);
        setConfidence(parsed.confidence);
        await loadDetail(submissionId);
      }
      await loadQueue();
      return true;
    } catch (error) {
      if (submissionId === selectedId) message.error(error instanceof Error ? error.message : "Qwen 审查失败");
      throw error;
    } finally {
      setReviewing(false);
    }
  }

  async function saveReview() {
    if (!selectedId) return;
    if (!items.length) return message.warning("请先完成 Qwen 形式审查");
    if (reviewStatus === "graded" && teacherScore === null) return message.warning("发布成绩前请填写教师评分");
    const response = await fetch(`/api/teacher/review/${selectedId}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: reviewStatus,
        score: reviewStatus === "returned" ? null : teacherScore,
        feedback: teacherComment,
        returnedReason: reviewStatus === "returned" ? teacherComment : undefined,
        items,
      }),
    });
    const result = await response.json();
    if (!response.ok) return message.error(result.error ?? "保存复评失败");
    message.success(reviewStatus === "graded" ? "成绩已发布" : reviewStatus === "returned" ? "已退回学生修改" : "复评已保存");
    await loadQueue();
    await loadDetail(selectedId);
  }

  function openBatch() {
    setBatchRows(queue.filter((item) => item.fileName && !item.hasReview).map((item) => ({ ...item, batchStatus: "pending" })));
    setBatchOpen(true);
  }

  async function runBatch() {
    const targets = queue.filter((item) => item.fileName && !item.hasReview);
    const nextRows = targets.map((item) => ({ ...item, batchStatus: "pending" as const }));
    setBatchRows(nextRows);
    if (!nextRows.length) {
      message.info("当前没有需要形式审查的地图");
      return;
    }
    setBatchRunning(true);
    for (const row of nextRows) {
      setBatchRows((current) => current.map((item) => item.id === row.id ? { ...item, batchStatus: "processing" } : item));
      try {
        await runReview(row.id);
        setBatchRows((current) => current.map((item) => item.id === row.id ? { ...item, batchStatus: "completed" } : item));
      } catch (error) {
        setBatchRows((current) => current.map((item) => item.id === row.id ? { ...item, batchStatus: "failed", error: error instanceof Error ? error.message : "审查失败" } : item));
      }
    }
    setBatchRunning(false);
    message.success("批量形式审查处理完成");
  }

  const assignmentOptions = useMemo(() => [...new Map(queue.map((item) => [item.assignmentId, { value: item.assignmentId, label: item.assignmentTitle }])).values()], [queue]);
  const batchCompleted = batchRows.filter((item) => ["completed", "failed"].includes(item.batchStatus)).length;

  return (
    <>
      <div className="page-head"><div><h1>教师测评</h1><p>选择学生地图，由 Qwen 检查四项形式要素，再由教师复评和发布成绩。</p></div><Space><Button icon={<ThunderboltOutlined />} onClick={openBatch}>批量形式审查</Button></Space></div>
      <section className="review-control-card">
        <div className="review-control-row"><label><b>当前作业</b><Select value={selected?.assignmentId} options={assignmentOptions} onChange={(assignmentId) => setSelectedId(queue.find((item) => item.assignmentId === assignmentId)?.id)} /></label><div className="review-stat-tags"><Tag>已上传 {queue.filter((item) => item.fileName).length}</Tag><Tag color="blue">待审查 {queue.filter((item) => item.fileName && !item.hasReview).length}</Tag></div></div>
        <div className="review-picker-grid"><label><b>班级</b><Select value={selected?.className} options={selected ? [{ value: selected.className, label: selected.className }] : []} /></label><label><b>学生</b><Select value={selectedId} options={queue.filter((item) => item.assignmentId === selected?.assignmentId).map((item) => ({ value: item.id, label: `${item.studentName} · ${item.studentNo}` }))} onChange={setSelectedId} /></label></div>
      </section>
      {!queue.length ? <section className="panel"><Empty description="当前没有学生提交" /></section> : (
        <>
          <Alert type={items.length ? "success" : "info"} showIcon message={summary} description={items.length ? `检测到 ${presentCount} / 4 项形式要素，Qwen 判断置信度 ${Math.round(confidence * 100)}%。` : "形式审查不计分，只有教师点击后才调用 Qwen。"} action={<Button loading={reviewing} icon={<ReloadOutlined />} onClick={() => void runReview()}>Qwen 形式审查</Button>} style={{ marginBottom: 18 }} />
          <div className="formal-review-grid">
            <section className="panel"><div className="panel-head"><span className="panel-title">地图预览</span>{latest && <Tag>第 {latest.version_no} 版</Tag>}</div><div className="panel-body"><MapFilePreview {...preview} loading={loading} onRefresh={() => selectedId && void loadDetail(selectedId)} /></div></section>
            <section className="panel"><div className="panel-head"><span className="panel-title">形式要素审查</span><Tag color={items.length ? "green" : "default"}>{items.length ? `已检查 ${items.length} 项` : "等待审查"}</Tag></div><div className="formal-check-list">{checks.map((check) => {
              const item = items.find((entry) => entry.rubricId === check.id);
              return <article className={`formal-check-card ${item ? item.present ? "is-present" : "is-missing" : ""}`} key={check.id}><div className="formal-check-icon">{item ? item.present ? <CheckCircleFilled /> : <CloseCircleFilled /> : "?"}</div><div className="formal-check-copy"><h3>{check.title}</h3><p>{item?.evidence ?? check.description}</p></div><Select value={item ? item.present ? "present" : "missing" : "pending"} disabled={!item} onChange={(value) => setItems((current) => current.map((entry) => entry.rubricId === check.id ? { ...entry, present: value === "present" } : entry))} options={[{ value: "pending", label: "待审查" }, { value: "present", label: "有" }, { value: "missing", label: "无" }]} /></article>;
            })}</div></section>
          </div>
          <section className="review-score-section">
            <div className="review-score-grid"><div className="review-score-card"><span>形式审查</span><strong>{items.length ? `${presentCount} / 4` : "待审查"}</strong><small>仅检查要素是否存在，不计入分数</small></div><div className="review-score-card"><span>缺失要素</span><strong>{items.length ? `${4 - presentCount} 项` : "待审查"}</strong><small>作为退回修改依据</small></div><div className="review-score-card is-active"><span>教师评分</span><strong>{reviewStatus === "returned" ? "无" : teacherScore ?? "未评分"}</strong><small>由教师人工评定</small></div><div className="review-score-card"><span>提交状态</span><strong>{selected?.status ?? "无"}</strong><small>保存后同步到学生端</small></div></div>
            <div className="teacher-review-form"><label><b>教师评分</b><InputNumber min={0} max={100} precision={1} disabled={reviewStatus === "returned"} value={teacherScore} onChange={setTeacherScore} /></label><label><b>状态</b><Select value={reviewStatus} onChange={(value) => { setReviewStatus(value); if (value === "returned") setTeacherScore(null); }} options={[{ value: "draft", label: "保存草稿" }, { value: "returned", label: "退回修改" }, { value: "reviewed", label: "确认复评" }, { value: "graded", label: "发布成绩" }]} /></label><label className="teacher-comment-field"><b>{reviewStatus === "returned" ? "退回原因（可不填）" : "评语"}</b><Input.TextArea rows={4} value={teacherComment} placeholder={reviewStatus === "returned" ? "可选：补充退回原因；不填写时学生端会提示按形式审查结果修改。" : "填写教师复评意见。"} onChange={(event) => setTeacherComment(event.target.value)} /></label><Button type="primary" size="large" icon={<SaveOutlined />} onClick={() => void saveReview()}>保存复评</Button></div>
          </section>
        </>
      )}
      <Modal title="批量形式审查" width={980} open={batchOpen} onCancel={() => !batchRunning && setBatchOpen(false)} footer={<Space><Button disabled={batchRunning} onClick={() => setBatchOpen(false)}>关闭</Button><Button type="primary" loading={batchRunning} icon={<ThunderboltOutlined />} onClick={() => void runBatch()}>审查全部待处理地图</Button></Space>}><Alert type="info" showIcon message="只处理已上传且尚无审查结果的最新版本" description="页面内逐份调用 Qwen；单份失败不会中止其他任务。" style={{ marginBottom: 16 }} /><Progress percent={batchRows.length ? Math.round(batchCompleted / batchRows.length * 100) : 0} status={batchRunning ? "active" : undefined} /><Table rowKey="id" size="small" style={{ marginTop: 16 }} dataSource={batchRows} pagination={false} locale={{ emptyText: "当前没有待审查地图" }} columns={[{ title: "学生", render: (_, row) => <div><b>{row.studentName}</b><div className="topbar-meta">{row.studentNo} · {row.className}</div></div> }, { title: "作业", dataIndex: "assignmentTitle" }, { title: "文件", dataIndex: "fileName" }, { title: "状态", dataIndex: "batchStatus", render: (value, row) => <Tag color={value === "completed" ? "green" : value === "failed" ? "red" : value === "processing" ? "blue" : "default"}>{row.error ?? value}</Tag> }]}/></Modal>
    </>
  );
}
