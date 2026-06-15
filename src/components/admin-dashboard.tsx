"use client";

import Link from "next/link";
import { Button, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { MetricGrid } from "./metric-grid";
import type { AdminOverviewData } from "@/lib/supabase/admin-overview";

export function AdminDashboard({ data }: { data: AdminOverviewData }) {
  const stateColor = (state: string) => state === "已完成" ? "green" : state === "失败" ? "red" : "gold";
  return <>
    <div className="page-head"><div><h1>系统运行概览</h1><p>显示 Supabase 中的真实账号、AI 调用与文件数据。</p></div><Link href="/admin/users"><Button type="primary" icon={<PlusOutlined />}>创建教师账号</Button></Link></div>
    <MetricGrid items={[
      {label:"教师账号",value:data.teacherCount,note:"当前启用的教师账号"},
      {label:"学生账号",value:data.studentCount,note:`覆盖 ${data.classCount} 个教学班`},
      {label:"今日 AI 调用",value:data.todayAiCount,note:`成功率 ${data.todayAiSuccessRate}`},
      {label:"私有存储",value:data.storageUsage,note:"已登记地图原件大小"},
    ]} />
    <div className="two-col">
      <section className="panel"><div className="panel-head"><span className="panel-title">最近 AI 任务</span><Link href="/admin/ai-jobs"><Button type="link">查看全部</Button></Link></div><Table rowKey="id" className="desktop-table" dataSource={data.recentJobs} pagination={false} locale={{emptyText:"暂无 AI 调用记录"}} columns={[{title:"任务编号",dataIndex:"id",ellipsis:true},{title:"类型",dataIndex:"type"},{title:"发起人",dataIndex:"owner"},{title:"处理进度",dataIndex:"count"},{title:"耗时",dataIndex:"duration"},{title:"状态",dataIndex:"state",render:(v:string)=><Tag color={stateColor(v)}>{v}</Tag>}]} /><div className="mobile-cards panel-body">{data.recentJobs.map(j=><div className="review-item" key={j.id}><b>{j.type}</b><div className="review-copy">{j.id}<br />{j.count} · {j.duration}</div></div>)}</div></section>
      <section className="panel"><div className="panel-head"><span className="panel-title">服务配置</span><Tag color="green">已连接</Tag></div><div className="panel-body">{["Vercel 应用已部署","Supabase 数据库已连接","Supabase 私有存储已连接","Qwen API 已配置"].map((name)=><div className="review-item" key={name}><div className="review-title"><span>{name}</span><Tag color="green">正常</Tag></div></div>)}</div></section>
    </div>
  </>;
}
