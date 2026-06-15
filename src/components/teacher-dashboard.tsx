"use client";

import Link from "next/link";
import { Button, Empty, Table, Tag } from "antd";
import { ArrowRightOutlined, PlusOutlined, RobotOutlined, UploadOutlined } from "@ant-design/icons";
import type { TeacherOverview } from "@/lib/supabase/teacher-data";
import { MetricGrid } from "./metric-grid";

const assignmentState: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "default" },
  published: { label: "提交中", color: "blue" },
  closed: { label: "已截止", color: "gold" },
  archived: { label: "已归档", color: "default" },
};

export function TeacherDashboard({ data }: { data: TeacherOverview }) {
  return <>
    <div className="page-head">
      <div><h1>教学概览</h1><p>显示当前账号名下班级、作业、学生和待复评数据。</p></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/teacher/students"><Button icon={<UploadOutlined />}>管理班级与学生</Button></Link>
        <Link href="/teacher/assignments"><Button type="primary" icon={<PlusOutlined />}>创建作业</Button></Link>
      </div>
    </div>
    <MetricGrid items={[
      { label: "当前教学班", value: data.classCount, note: `共 ${data.studentCount} 名学生` },
      { label: "待人工复评", value: data.pendingReviewCount, note: `其中 ${data.aiFailedCount} 份 AI 审查失败` },
      { label: "已创建作业", value: data.assignmentCount, note: `${data.publishedAssignmentCount} 份已发布` },
      { label: "已发布平均分", value: data.averageScore ?? "暂无成绩", note: `${data.gradedCount} 份成绩已发布` },
    ]} />
    <div className="two-col">
      <section className="panel">
        <div className="panel-head"><span className="panel-title">最近作业</span><Link href="/teacher/assignments"><Button type="link">全部作业 <ArrowRightOutlined /></Button></Link></div>
        <Table
          rowKey="id"
          className="desktop-table"
          dataSource={data.assignments}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无作业，请先创建并发布作业" /> }}
          columns={[
            { title: "作业", dataIndex: "title", render: (value: string, row) => <div><b>{value}</b><div className="topbar-meta">{row.className} · 截止 {new Date(row.deadline).toLocaleString("zh-CN")}</div></div> },
            { title: "提交数", dataIndex: "submittedCount", width: 90 },
            { title: "已评分", dataIndex: "gradedCount", width: 90 },
            { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <Tag color={assignmentState[value]?.color}>{assignmentState[value]?.label ?? value}</Tag> },
            { title: "", width: 80, render: () => <Link href="/teacher/review"><Button type="link">审查</Button></Link> },
          ]}
        />
      </section>
      <section className="panel">
        <div className="panel-head"><span className="panel-title">需要处理</span><RobotOutlined /></div>
        <div className="panel-body">
          <div className="review-item"><div className="review-title"><span>{data.pendingReviewCount} 份提交等待复评</span><Tag color={data.pendingReviewCount ? "gold" : "green"}>{data.pendingReviewCount ? "待处理" : "已清空"}</Tag></div><div className="review-copy">教师确认审查结果后，学生才能看到反馈。</div></div>
          <div className="review-item"><div className="review-title"><span>{data.aiFailedCount} 份 AI 审查失败</span><Tag color={data.aiFailedCount ? "red" : "green"}>{data.aiFailedCount ? "需重试" : "正常"}</Tag></div><div className="review-copy">AI 失败的作业仍可直接进行人工复评。</div></div>
          <div className="review-item"><div className="review-title"><span>{data.returnedCount} 份作业已退回修改</span><Tag color="blue">跟进</Tag></div><div className="review-copy">学生重新提交后会生成新的历史版本。</div></div>
        </div>
      </section>
    </div>
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-head"><span className="panel-title">最近学生</span><Link href="/teacher/students"><Button type="link">班级管理</Button></Link></div>
      <Table
        rowKey={(row) => `${row.classId}-${row.id}`}
        className="desktop-table"
        dataSource={data.students}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: <Empty description="暂无学生，请先创建班级并导入学生" /> }}
        columns={[
          {title:"学号",dataIndex:"studentNo"},
          {title:"姓名",dataIndex:"name"},
          {title:"班级",dataIndex:"className"},
          {title:"已交作业",dataIndex:"submittedCount"},
          {title:"平均分",dataIndex:"averageScore",render:(value:number|null)=>value ?? "未评分"},
          {title:"状态",dataIndex:"state",render:(value:string)=><Tag color={value==="正常"?"green":"orange"}>{value}</Tag>},
        ]}
      />
    </section>
  </>;
}
