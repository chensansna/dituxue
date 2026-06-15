"use client";

import { useState } from "react";
import { Alert, Button, Space, Tag, Upload, message } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, FilePdfOutlined, UploadOutlined } from "@ant-design/icons";
import { MetricGrid } from "./metric-grid";
import { saveSubmissionFile } from "@/lib/browser-submissions";

const works = [
  { title:"专题地图设计：城市公共服务设施", state:"待修改", color:"orange", due:"延期至 06月18日 23:59", note:"教师反馈：请补充公共交通站点图例，并处理道路注记重叠。", action:"上传修改稿" },
  { title:"地形图符号与注记配置", state:"可提交", color:"green", due:"截止 06月22日 23:59", note:"支持 PNG、JPG、PDF，文件不超过 50 MB。", action:"上传作业" },
  { title:"分级统计图制作", state:"已评分", color:"green", due:"最终成绩 94 分", note:"审查已完成，教师反馈与详细评分已发布。", action:"查看反馈" },
];

export function StudentDashboard() {
  const [uploading,setUploading]=useState(false);
  return <>
    <div className="page-head"><div><h1>你好，林晓雨</h1><p>查看待提交任务、修改反馈和已经发布的成绩。</p></div></div>
    <MetricGrid items={[{label:"待提交",value:1,note:"最近截止：06月22日"},{label:"待修改",value:1,note:"已获得个人延期"},{label:"已完成",value:3,note:"本学期共 5 次作业"},{label:"平均成绩",value:"92.5",note:"当前班级第 4 名"}]} />
    <Alert message="有 1 份作业被退回修改" description="教师已为你延长提交时间，请在 06月18日 23:59 前提交新版本。" type="warning" showIcon style={{marginBottom:18}} />
    <section className="panel"><div className="panel-head"><span className="panel-title">我的地图学作业</span><Tag color="green">地图学 2024-1班</Tag></div><div className="panel-body">
      {works.map((work,i)=><div className="review-item" key={work.title}><div className="review-title"><span>{i===2?<CheckCircleOutlined />:<ClockCircleOutlined />} &nbsp;{work.title}</span><Tag color={work.color}>{work.state}</Tag></div><div className="review-copy">{work.due}<br />{work.note}</div><Space style={{marginTop:12}}>{i<2?<Upload accept=".png,.jpg,.jpeg,.pdf" showUploadList={false} beforeUpload={(file)=>{setUploading(true);void saveSubmissionFile(file).then(()=>message.success("文件已保存，教师端现在可以预览")).catch(()=>message.error("文件保存失败，请重试")).finally(()=>setUploading(false));return false;}}><Button type={i===0?"primary":"default"} loading={uploading} icon={<UploadOutlined />}>{work.action}</Button></Upload>:<Button>{work.action}</Button>}{i===0&&<Button icon={<FilePdfOutlined />}>查看退回原因</Button>}</Space></div>)}
    </div></section>
  </>;
}
