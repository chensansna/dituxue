"use client";

import { Button, Progress, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { MetricGrid } from "./metric-grid";

const jobs = [
  {key:"1",id:"qwen_batch_20260615_0042",type:"地图批量审查",owner:"王静怡",count:"42 / 42",duration:"08:32",state:"已完成"},
  {key:"2",id:"qwen_live_20260615_1831",type:"单份地图审查",owner:"学生提交",count:"1 / 1",duration:"00:18",state:"已完成"},
  {key:"3",id:"qwen_roster_20260615_0038",type:"名单识别",owner:"李明哲",count:"48 / 48",duration:"00:24",state:"已完成"},
];

export function AdminDashboard() {
  return <>
    <div className="page-head"><div><h1>系统运行概览</h1><p>管理教师账号，监控 Qwen 调用、存储和服务运行状态。</p></div><Button type="primary" icon={<PlusOutlined />}>创建教师账号</Button></div>
    <MetricGrid items={[{label:"教师账号",value:12,note:"本周新增 2 个"},{label:"学生账号",value:486,note:"覆盖 9 个教学班"},{label:"今日 AI 调用",value:93,note:"成功率 98.9%"},{label:"私有存储",value:"8.7 GB",note:"当前用量 43.5%"}]} />
    <div className="two-col">
      <section className="panel"><div className="panel-head"><span className="panel-title">最近 AI 任务</span><Button type="link">查看全部</Button></div><Table className="desktop-table" dataSource={jobs} pagination={false} columns={[{title:"任务编号",dataIndex:"id"},{title:"类型",dataIndex:"type"},{title:"发起人",dataIndex:"owner"},{title:"处理进度",dataIndex:"count"},{title:"耗时",dataIndex:"duration"},{title:"状态",dataIndex:"state",render:(v:string)=><Tag color="green">{v}</Tag>}]} /><div className="mobile-cards panel-body">{jobs.map(j=><div className="review-item" key={j.key}><b>{j.type}</b><div className="review-copy">{j.id}<br />{j.count} · {j.duration}</div></div>)}</div></section>
      <section className="panel"><div className="panel-head"><span className="panel-title">服务状态</span><Tag color="green">全部正常</Tag></div><div className="panel-body">{[["Vercel 应用服务",100],["Supabase 数据库",100],["Supabase 私有存储",100],["Qwen 多模态 API",99]].map(([n,p])=><div className="review-item" key={String(n)}><div className="review-title"><span>{n}</span><span>{p}%</span></div><Progress percent={Number(p)} showInfo={false} strokeColor="#176b4d" /></div>)}</div></section>
    </div>
  </>;
}
