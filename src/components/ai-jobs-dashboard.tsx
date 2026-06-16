"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, message, Select, Space, Table, Tag } from "antd";
import { DownloadOutlined, ReloadOutlined, SearchOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { MetricGrid } from "./metric-grid";
import type { AiJobLog } from "@/lib/ai-job-log";

const typeNames: Record<AiJobLog["type"], string> = {
  connection_check: "Qwen 连通性检查",
  map_review: "单份地图审查",
  roster_parse: "学生名单识别",
  batch_review: "地图批量审查",
};

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} 秒`;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) throw new Error(response.ok ? "接口没有返回内容" : `接口请求失败（${response.status}）`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`接口返回的不是 JSON（${response.status}）`);
  }
}

export function AiJobsDashboard() {
  const [jobs, setJobs] = useState<AiJobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");

  async function loadJobs() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ai-jobs", { cache: "no-store" });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error);
      setJobs(data.jobs);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "读取 AI 调用记录失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch("/api/admin/ai-jobs", { cache: "no-store" })
      .then(readJsonResponse)
      .then((data) => setJobs(data.jobs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const matchesType = type === "all" || job.type === type;
    const keyword = search.trim().toLowerCase();
    return matchesType && (!keyword || `${job.id} ${job.model} ${typeNames[job.type]} ${job.error ?? ""}`.toLowerCase().includes(keyword));
  }), [jobs, search, type]);

  const completed = jobs.filter((job) => job.status === "completed").length;
  const successRate = jobs.length ? `${(completed / jobs.length * 100).toFixed(1)}%` : "暂无";
  const averageDuration = jobs.length ? `${Math.round(jobs.reduce((sum, job) => sum + job.durationMs, 0) / jobs.length)} ms` : "暂无";

  async function testConnection() {
    const hide = message.loading("正在调用 Qwen 检查连接...", 0);
    try {
      const response = await fetch("/api/qwen/health");
      const result = await readJsonResponse(response);
      if (!response.ok) throw new Error(result.error);
      message.success(`Qwen 连接正常，模型：${result.model}`);
      await loadJobs();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Qwen 连接失败");
      await loadJobs();
    } finally {
      hide();
    }
  }

  function exportCsv() {
    const rows = [
      ["任务编号", "类型", "状态", "模型", "数量", "耗时毫秒", "错误", "创建时间"],
      ...filteredJobs.map((job) => [job.id, typeNames[job.type], job.status, job.model, job.itemCount, job.durationMs, job.error ?? "", job.createdAt]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `qwen-ai-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <>
    <div className="page-head">
      <div><h1>AI 调用记录</h1><p>查看本系统实际发起的 Qwen 调用、执行耗时和失败原因。</p></div>
      <Space wrap><Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!filteredJobs.length}>导出 CSV</Button><Button type="primary" icon={<ThunderboltOutlined />} onClick={() => void testConnection()}>测试 Qwen 连接</Button></Space>
    </div>
    <MetricGrid items={[
      { label: "累计调用", value: jobs.length, note: "记录本机实际 API 请求" },
      { label: "成功调用", value: completed, note: `失败 ${jobs.length - completed} 次` },
      { label: "成功率", value: successRate, note: "包含连接检查与审查任务" },
      { label: "平均耗时", value: averageDuration, note: "从请求发起到结果返回" },
    ]} />
    <Alert type="success" showIcon message="当前使用 Supabase 记录 AI 调用" description="连接检查、形式审查和失败原因会写入 ai_jobs 表，刷新页面或更换设备后仍可查看。" style={{ marginBottom: 18 }} />
    <section className="panel">
      <div className="panel-head">
        <Space wrap>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} prefix={<SearchOutlined />} placeholder="搜索任务编号、模型或错误" style={{ width: 280 }} />
          <Select value={type} onChange={setType} style={{ width: 170 }} options={[{ value: "all", label: "全部任务类型" }, ...Object.entries(typeNames).map(([value, label]) => ({ value, label }))]} />
        </Space>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadJobs()}>刷新</Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredJobs}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
        locale={{ emptyText: "暂无调用记录，点击“测试 Qwen 连接”生成第一条记录。" }}
        columns={[
          { title: "任务", dataIndex: "id", render: (value: string, row: AiJobLog) => <div><b>{typeNames[row.type]}</b><div className="topbar-meta">{value}</div></div> },
          { title: "状态", dataIndex: "status", width: 90, render: (value: AiJobLog["status"]) => <Tag color={value === "completed" ? "green" : "red"}>{value === "completed" ? "成功" : "失败"}</Tag> },
          { title: "模型", dataIndex: "model", width: 150 },
          { title: "处理数量", dataIndex: "itemCount", width: 100 },
          { title: "耗时", dataIndex: "durationMs", width: 100, render: formatDuration },
          { title: "错误信息", dataIndex: "error", ellipsis: true, render: (value?: string) => value || "无" },
          { title: "调用时间", dataIndex: "createdAt", width: 180, render: (value: string) => new Date(value).toLocaleString("zh-CN") },
        ]}
      />
    </section>
  </>;
}
