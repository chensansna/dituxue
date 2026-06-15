"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Checkbox, DatePicker, Form, Input, message, Modal, Progress, Select, Space, Table, Tabs, Tag, Upload } from "antd";
import { ArrowRightOutlined, FileImageOutlined, PlusOutlined, RobotOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { assignments as initialAssignments, students as initialStudents } from "@/lib/mock-data";
import { MetricGrid } from "./metric-grid";

type Assignment = (typeof initialAssignments)[number];
type Student = (typeof initialStudents)[number];
type RosterStudent = { studentNo: string; name: string; className: string; confidence?: number; issue?: string };

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parsePastedRoster(text: string, className: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/[\s,，\t]+/).filter(Boolean);
    return { studentNo: parts[0] ?? "", name: parts.slice(1).join(" ") || "待确认姓名", className };
  }).filter((student) => student.studentNo);
}

export function TeacherDashboard() {
  const [assignmentRows, setAssignmentRows] = useState<Assignment[]>(initialAssignments);
  const [studentRows, setStudentRows] = useState<Student[]>(initialStudents);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterPreview, setRosterPreview] = useState<RosterStudent[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [targetClass, setTargetClass] = useState("地图学 2024-1班");
  const [noDeadline, setNoDeadline] = useState(false);
  const [assignmentForm] = Form.useForm();

  const assignmentColumns = [
    { title: "作业", dataIndex: "title", render: (value: string, row: Assignment) => <div><b>{value}</b><div className="topbar-meta">{row.className} · 截止 {row.due}</div></div> },
    { title: "提交进度", dataIndex: "submitted", width: 130 },
    { title: "AI / 人工审查", dataIndex: "reviewed", width: 160, render: (value: number) => <Progress percent={Math.round(value / 48 * 100)} size="small" strokeColor="#176b4d" /> },
    { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <Tag color={value === "已评分" ? "green" : "gold"}>{value}</Tag> },
    { title: "", width: 90, render: () => <Link href="/teacher/review"><Button type="link">查看</Button></Link> },
  ];

  function createAssignment() {
    assignmentForm.validateFields().then((values) => {
      const classes = values.classNames as string[];
      const nextRows: Assignment[] = classes.map((className) => ({
          key: crypto.randomUUID(),
          title: values.title,
          className,
          due: noDeadline ? "无截止日期" : values.deadline.format("MM月DD日 HH:mm"),
          submitted: "0 / 48",
          reviewed: 0,
          status: values.publishNow ? "提交中" : "草稿",
      }));
      setAssignmentRows((current) => [...nextRows, ...current]);
      setAssignmentOpen(false);
      assignmentForm.resetFields();
      setNoDeadline(false);
      message.success(`作业已发布到 ${classes.length} 个班级`);
    }).catch(() => undefined);
  }

  async function parseRosterFile(file: File) {
    setRosterLoading(true);
    try {
      if (file.type.startsWith("image/")) {
        const fileUrl = await fileToDataUrl(file);
        const response = await fetch("/api/qwen/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileUrl }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Qwen 名单识别失败");
        setRosterPreview(result.map((student: RosterStudent) => ({ ...student, className: student.className || targetClass })));
      } else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        setRosterPreview(rows.map((row) => ({
          studentNo: String(row["学号"] || row["studentNo"] || row["编号"] || ""),
          name: String(row["姓名"] || row["name"] || ""),
          className: String(row["班级"] || row["className"] || targetClass),
        })).filter((student) => student.studentNo && student.name));
      }
      message.success("名单解析完成，请确认后导入");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "名单解析失败");
    } finally {
      setRosterLoading(false);
    }
  }

  function confirmRoster() {
    if (!rosterPreview.length) {
      message.warning("请先解析或粘贴学生名单");
      return;
    }
    const existing = new Set(studentRows.map((student) => student.no));
    const added = rosterPreview.filter((student) => !existing.has(student.studentNo)).map((student) => ({
      key: crypto.randomUUID(),
      no: student.studentNo,
      name: student.name,
      className: student.className || targetClass,
      submitted: 0,
      avg: 0,
      state: "新导入",
    }));
    setStudentRows((current) => [...added, ...current]);
    setRosterOpen(false);
    setRosterPreview([]);
    setPasteText("");
    message.success(`成功导入 ${added.length} 名学生`);
  }

  return <>
    <div className="page-head"><div><h1>教学概览</h1><p>集中处理待审查作业、提交异常与本周教学任务。</p></div><Space wrap><Button icon={<UploadOutlined />} onClick={() => setRosterOpen(true)}>导入学生名单</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setAssignmentOpen(true)}>创建作业</Button></Space></div>
    <MetricGrid items={[{ label: "当前教学班", value: 3, note: `共 ${134 + studentRows.length} 名学生` }, { label: "待人工复评", value: 17, note: "其中 5 份 AI 标记高风险" }, { label: "本周提交率", value: "86.4%", note: "较上周提升 4.2%" }, { label: "已发布平均分", value: "87.6", note: "最高分 97.0" }]} />
    <div className="two-col">
      <section className="panel"><div className="panel-head"><span className="panel-title">进行中的作业</span><Button type="link">全部作业 <ArrowRightOutlined /></Button></div><Table className="desktop-table" columns={assignmentColumns} dataSource={assignmentRows} pagination={false} /><div className="mobile-cards panel-body">{assignmentRows.map((assignment) => <div className="review-item" key={assignment.key}><div className="review-title"><span>{assignment.title}</span><Tag>{assignment.status}</Tag></div><div className="review-copy">{assignment.className}<br />提交 {assignment.submitted} · 截止 {assignment.due}</div></div>)}</div></section>
      <section className="panel"><div className="panel-head"><span className="panel-title">需要处理</span><RobotOutlined /></div><div className="panel-body">
        {[["5 份作业需要重点复核","AI 检测到形式要素缺失"],["3 名学生尚未提交","专题地图设计将在 3 天后截止"],["批量审查已完成","42 份结果已就绪，等待教师确认"]].map(([title,copy],index)=><div className="review-item" key={title}><div className="review-title"><span>{title}</span><Tag color={index===0?"red":"green"}>{index===0?"高优先级":"待处理"}</Tag></div><div className="review-copy">{copy}</div></div>)}
      </div></section>
    </div>
    <section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><span className="panel-title">学生动态</span><Button type="link">班级管理</Button></div><Table className="desktop-table" dataSource={studentRows} pagination={{pageSize:8}} columns={[{title:"学号",dataIndex:"no"},{title:"姓名",dataIndex:"name"},{title:"班级",dataIndex:"className"},{title:"已交作业",dataIndex:"submitted"},{title:"平均分",dataIndex:"avg"},{title:"状态",dataIndex:"state",render:(value:string)=><Tag color={value==="正常"?"green":"orange"}>{value}</Tag>}]} /></section>

    <Modal title="创建地图学作业" open={assignmentOpen} onCancel={() => {setAssignmentOpen(false);setNoDeadline(false);}} onOk={createAssignment} okText="创建作业" cancelText="取消">
      <Form form={assignmentForm} layout="vertical" initialValues={{ classNames: ["地图学 2024-1班"], publishNow: true }}>
        <Form.Item name="title" label="作业标题" rules={[{required:true,message:"请输入作业标题"}]}><Input placeholder="例如：专题地图设计" /></Form.Item>
        <Form.Item name="classNames" label="发布班级" rules={[{required:true,message:"请至少选择一个班级"}]}><Select mode="multiple" placeholder="可选择多个班级" maxTagCount="responsive" options={[{value:"地图学 2024-1班",label:"地图学 2024-1班"},{value:"地图学 2024-2班",label:"地图学 2024-2班"},{value:"地图学 2024-3班",label:"地图学 2024-3班"}]} /></Form.Item>
        <Form.Item label="截止时间" required={!noDeadline}>
          <Space direction="vertical" style={{width:"100%"}}>
            <Form.Item name="deadline" noStyle rules={[{validator:(_,value)=>noDeadline||value?Promise.resolve():Promise.reject(new Error("请选择截止时间或勾选无截止日期"))}]}>
              <DatePicker showTime disabled={noDeadline} style={{width:"100%"}} placeholder={noDeadline?"已设置为无截止日期":"请选择截止日期和时间"} />
            </Form.Item>
            <Checkbox checked={noDeadline} onChange={(event)=>{setNoDeadline(event.target.checked);if(event.target.checked)assignmentForm.setFieldValue("deadline",null);}}>无截止日期</Checkbox>
          </Space>
        </Form.Item>
        <Form.Item name="description" label="任务说明"><Input.TextArea rows={4} placeholder="填写制图任务、提交格式和注意事项" /></Form.Item>
        <Form.Item name="publishNow" label="创建后状态"><Select options={[{value:true,label:"立即发布"},{value:false,label:"保存为草稿"}]} /></Form.Item>
      </Form>
    </Modal>

    <Modal title="导入学生名单" width={860} open={rosterOpen} onCancel={() => setRosterOpen(false)} onOk={confirmRoster} okText="确认导入" cancelText="取消">
      <Space style={{marginBottom:14}}><span>目标班级</span><Select value={targetClass} onChange={setTargetClass} style={{width:220}} options={[{value:"地图学 2024-1班",label:"地图学 2024-1班"},{value:"地图学 2024-2班",label:"地图学 2024-2班"}]} /></Space>
      <Tabs items={[
        {key:"file",label:"上传文件",children:<Upload.Dragger accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg" showUploadList={false} beforeUpload={(file)=>{void parseRosterFile(file);return false;}}><p><FileImageOutlined style={{fontSize:28,color:"#176b4d"}} /></p><p>上传 CSV、Excel 或名单图片</p><p className="topbar-meta">图片使用 Qwen 识别，表格直接解析“学号、姓名、班级”列</p></Upload.Dragger>},
        {key:"paste",label:"粘贴名单",children:<><Input.TextArea rows={7} value={pasteText} onChange={(event)=>setPasteText(event.target.value)} placeholder={"每行一名学生，例如：\n2024010301 张三\n2024010302 李四"} /><Button style={{marginTop:10}} onClick={()=>setRosterPreview(parsePastedRoster(pasteText,targetClass))}>生成名单预览</Button></>},
      ]} />
      <Table loading={rosterLoading} rowKey="studentNo" size="small" style={{marginTop:16}} dataSource={rosterPreview} pagination={{pageSize:6}} locale={{emptyText:"解析后将在这里显示名单预览"}} columns={[{title:"学号",dataIndex:"studentNo"},{title:"姓名",dataIndex:"name"},{title:"班级",dataIndex:"className"},{title:"识别置信度",dataIndex:"confidence",render:(value?:number)=>value?`${Math.round(value*100)}%`:"直接导入"},{title:"问题",dataIndex:"issue",render:(value?:string)=>value||"无"}]} />
    </Modal>
  </>;
}
