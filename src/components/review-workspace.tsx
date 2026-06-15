"use client";

import { useState } from "react";
import { Alert, Button, Input, InputNumber, message, Modal, Progress, Select, Table, Tag } from "antd";
import { CheckCircleFilled, CloseCircleFilled, DownloadOutlined, ReloadOutlined, SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { MapFilePreview } from "./map-file-preview";
import { getLatestSubmissionFile, getPendingSubmissions, saveSubmissionReview, type LocalSubmission } from "@/lib/browser-submissions";
import { reviewResultSchema } from "@/lib/domain";
import type { z } from "zod";

type ReviewResult = z.infer<typeof reviewResultSchema>;
type ReviewItem = ReviewResult["items"][number];
type BatchRow = LocalSubmission & { key: string; status: "pending" | "processing" | "completed" | "failed"; result?: ReviewResult; error?: string };

const checks = [
  { id: "north_arrow", title: "指北针", description: "检查地图中是否存在明确指北符号或北向标记" },
  { id: "scale_bar", title: "比例尺", description: "检查数字比例尺、文字比例尺或图解比例尺" },
  { id: "legend", title: "图例", description: "检查是否存在说明地图符号或颜色的图例" },
  { id: "coordinate_grid", title: "坐标格网", description: "检查格网线、经纬网线或坐标刻度标注" },
];

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ReviewWorkspace() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState("上传地图后，点击“Qwen 形式审查”检查四项形式要素。");
  const [confidence, setConfidence] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [teacherScore, setTeacherScore] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState("draft");
  const [teacherComment, setTeacherComment] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchCompleted, setBatchCompleted] = useState(0);

  async function runReview(fileOverride?: File) {
    setReviewing(true);
    try {
      const file = fileOverride ?? await getLatestSubmissionFile();
      if (!file) throw new Error("请先选择或上传地图图片。");
      if (!file.type.startsWith("image/")) throw new Error("Qwen 形式审查目前支持 PNG、JPG 图片。");
      const imageUrl = await fileToDataUrl(file);
      const response = await fetch("/api/qwen/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, rubric: checks.map(({ id, title }) => ({ id, title })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Qwen 审查失败");
      const parsed = reviewResultSchema.parse(result);
      setItems(checks.map((check) => parsed.items.find((item) => item.rubricId === check.id) ?? { rubricId: check.id, present: false, evidence: "未检测到该要素。" }));
      setSummary(parsed.summary);
      setConfidence(parsed.confidence);
      message.success("Qwen 形式要素审查完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Qwen 审查失败");
    } finally {
      setReviewing(false);
    }
  }

  const presentCount = items.filter((item) => item.present).length;
  const isReturned = reviewStatus === "returned";
  const totalScore = isReturned ? null : teacherScore;

  function saveReview() {
    if (reviewStatus === "published" && teacherScore === null) {
      message.warning("请先填写教师评分");
      return;
    }
    if (reviewStatus === "returned") {
      message.success("已退回学生修改，本次复评不设置成绩");
      return;
    }
    message.success(reviewStatus === "published" ? `成绩已发布，总评分 ${totalScore}` : "复评草稿已保存");
  }

  function changeReviewStatus(status: string) {
    setReviewStatus(status);
    if (status === "returned") setTeacherScore(null);
  }

  async function openBatchReview() {
    const pending = await getPendingSubmissions();
    setBatchRows(pending.map((submission) => ({ ...submission, key: submission.studentNo, status: "pending" })));
    setBatchCompleted(0);
    setBatchOpen(true);
  }

  async function runBatchReview() {
    if (!batchRows.length) {
      message.info("当前没有已上传且待形式审查的地图");
      return;
    }
    setBatchRunning(true);
    setBatchCompleted(0);
    for (const row of batchRows) {
      setBatchRows((current) => current.map((item) => item.key === row.key ? { ...item, status: "processing" } : item));
      try {
        if (!row.file.type.startsWith("image/")) throw new Error("当前仅支持图片形式审查");
        const imageUrl = await fileToDataUrl(row.file);
        const response = await fetch("/api/qwen/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl, rubric: checks.map(({ id, title }) => ({ id, title })) }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Qwen 审查失败");
        const result = reviewResultSchema.parse(body);
        await saveSubmissionReview(row.studentNo, result);
        setBatchRows((current) => current.map((item) => item.key === row.key ? { ...item, status: "completed", result } : item));
      } catch (error) {
        setBatchRows((current) => current.map((item) => item.key === row.key ? { ...item, status: "failed", error: error instanceof Error ? error.message : "审查失败" } : item));
      }
      setBatchCompleted((value) => value + 1);
    }
    setBatchRunning(false);
    message.success("批量形式审查已完成");
  }

  return <>
    <div className="page-head"><div><h1>教师测评</h1><p>选择学生地图，由 Qwen 检查指北针、比例尺、图例和坐标格网。</p></div><div><Button icon={<ThunderboltOutlined />} onClick={() => void openBatchReview()} style={{marginRight:8}}>批量形式审查</Button><Button icon={<DownloadOutlined />}>导出审查表</Button></div></div>

    <section className="review-control-card">
      <div className="review-control-row">
        <label><b>当前作业</b><Select defaultValue="专题地图设计" options={[{value:"专题地图设计",label:"专题地图设计：标杆社区和待优化社区分布图"}]} /></label>
        <div className="review-stat-tags"><Tag>已上传 2</Tag><Tag>未上传 7</Tag><Tag color="blue">Qwen 形式审查</Tag></div>
      </div>
      <div className="review-picker-grid">
        <label><b>1. 选择班级</b><Select defaultValue="地图学 2024-1班" options={[{value:"地图学 2024-1班",label:"地图学 2024-1班"}]} /></label>
        <label><b>2. 选择学生</b><Select defaultValue="林晓雨 · 2024010215" options={[{value:"林晓雨 · 2024010215",label:"林晓雨 · 2024010215"}]} /></label>
      </div>
    </section>

    <Alert type={items.length ? "success" : "info"} showIcon message={summary} description={items.length ? `检测到 ${presentCount} / 4 项形式要素，Qwen 判断置信度 ${Math.round(confidence * 100)}%。` : "审查结果仅判断形式要素是否存在，不评分。"} action={<Button loading={reviewing} icon={<ReloadOutlined />} onClick={() => void runReview()}>Qwen 形式审查</Button>} style={{marginBottom:18}} />

    <div className="formal-review-grid">
      <section className="panel"><div className="panel-head"><span className="panel-title">地图预览</span><Tag>当前学生提交</Tag></div><div className="panel-body"><MapFilePreview /></div></section>
      <section className="panel"><div className="panel-head"><span className="panel-title">形式要素审查</span><Tag color={items.length ? "green" : "default"}>{items.length ? `已检查 ${items.length} 项` : "等待审查"}</Tag></div><div className="formal-check-list">
        {checks.map((check) => {
          const item = items.find((entry) => entry.rubricId === check.id);
          return <article className={`formal-check-card ${item ? (item.present ? "is-present" : "is-missing") : ""}`} key={check.id}>
            <div className="formal-check-icon">{item ? (item.present ? <CheckCircleFilled /> : <CloseCircleFilled />) : "?"}</div>
            <div className="formal-check-copy"><h3>{check.title}</h3><p>{item?.evidence ?? check.description}</p></div>
            <Select
              value={item ? (item.present ? "present" : "missing") : "pending"}
              disabled={!item}
              onChange={(value) => setItems((current) => current.map((entry) => entry.rubricId === check.id ? {...entry, present:value === "present"} : entry))}
              options={[{value:"pending",label:"待审查"},{value:"present",label:"有"},{value:"missing",label:"无"}]}
            />
          </article>;
        })}
      </div></section>
    </div>

    <section className="review-score-section">
      <div className="review-score-grid">
        <div className="review-score-card"><span>形式审查</span><strong>{items.length ? `${presentCount} / 4` : "待审查"}</strong><small>仅检查要素是否存在，不计入分数</small></div>
        <div className="review-score-card"><span>缺失要素</span><strong>{items.length ? `${4 - presentCount} 项` : "待审查"}</strong><small>作为教师复评与退回修改依据</small></div>
        <div className="review-score-card is-active"><span>教师评分</span><strong>{isReturned ? "无" : teacherScore === null ? "未评分" : teacherScore.toFixed(1)}</strong><small>{isReturned ? "退回修改不设置成绩" : "满分 100 分 · 由教师人工评定"}</small></div>
        <div className="review-score-card"><span>总评分</span><strong>{isReturned ? "无" : totalScore === null ? "未评分" : totalScore.toFixed(1)}</strong><small>{isReturned ? "学生重新提交后再评分" : totalScore === null ? "待教师评分后生成" : "等于教师评分"}</small></div>
      </div>

      <div className="teacher-review-form">
        <label><b>教师评分</b><InputNumber min={0} max={100} precision={1} disabled={isReturned} value={teacherScore} onChange={(value) => setTeacherScore(value)} placeholder={isReturned ? "退回修改不设置成绩" : "请输入 0-100 分"} /></label>
        <label><b>状态</b><Select value={reviewStatus} onChange={changeReviewStatus} options={[{value:"draft",label:"保存草稿"},{value:"returned",label:"退回修改"},{value:"published",label:"发布成绩"}]} /></label>
        <label className="teacher-comment-field"><b>评语</b><Input.TextArea rows={4} value={teacherComment} onChange={(event) => setTeacherComment(event.target.value)} placeholder="填写教师复评意见，说明地图内容表达、制图质量和修改建议。" /></label>
        <Button type="primary" size="large" icon={<SaveOutlined />} onClick={saveReview}>保存复评</Button>
      </div>
    </section>

    <Modal title="批量形式审查" width={980} open={batchOpen} onCancel={() => !batchRunning && setBatchOpen(false)} footer={[
      <Button key="close" disabled={batchRunning} onClick={() => setBatchOpen(false)}>关闭</Button>,
      <Button key="run" type="primary" loading={batchRunning} icon={<ThunderboltOutlined />} onClick={() => void runBatchReview()}>审查全部待处理地图</Button>,
    ]}>
      <Alert type="info" showIcon message="仅处理已上传且尚未完成形式审查的地图" description="已完成审查的提交不会重复调用 Qwen。学生重新提交后会重新进入待审查队列。" style={{marginBottom:16}} />
      <Progress percent={batchRows.length ? Math.round(batchCompleted / batchRows.length * 100) : 0} status={batchRunning ? "active" : undefined} strokeColor="#176b4d" />
      <Table rowKey="key" size="small" style={{marginTop:16}} dataSource={batchRows} pagination={false} locale={{emptyText:"当前没有已上传且待形式审查的地图"}} columns={[
        {title:"学生",render:(_:unknown,row:BatchRow)=><div><b>{row.studentName}</b><div className="topbar-meta">{row.studentNo} · {row.className}</div></div>},
        {title:"上传文件",dataIndex:["file","name"]},
        {title:"状态",dataIndex:"status",width:110,render:(status:BatchRow["status"])=><Tag color={status==="completed"?"green":status==="failed"?"red":status==="processing"?"blue":"default"}>{{pending:"待审查",processing:"审查中",completed:"已完成",failed:"失败"}[status]}</Tag>},
        {title:"形式要素结果",render:(_:unknown,row:BatchRow)=>row.result ? checks.map((check)=>{const result=row.result?.items.find((item)=>item.rubricId===check.id);return <Tag key={check.id} color={result?.present?"green":"red"}>{check.title} {result?.present?"有":"无"}</Tag>}) : row.error ?? "待审查"},
      ]} />
    </Modal>
  </>;
}
