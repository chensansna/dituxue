"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Form, Input } from "antd";
import { ApartmentOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";

const roles = [{key:"teacher",label:"教师"},{key:"student",label:"学生"},{key:"admin",label:"管理员"}] as const;

export function Login() {
  const router=useRouter();
  const [role,setRole]=useState<(typeof roles)[number]["key"]>("teacher");
  return <div className="login-page">
    <section className="login-intro"><div className="brand" style={{padding:0,border:0}}><div className="brand-mark"><ApartmentOutlined /></div><div><div className="brand-title">基于 LLM 的地图学教学辅助系统</div><div className="brand-sub">Qwen AI 驱动的形式审查与教学反馈</div></div></div><div><h1>让地图形式审查更高效，让教学反馈更有依据。</h1><p>统一管理班级、地图作业、AI 审查、人工复评与成绩发布。每一次提交和修改都有清晰记录。</p></div><div style={{color:"#83ad99",fontSize:12}}>线上 Qwen API · 私有文件存储 · 角色权限隔离</div></section>
    <section className="login-form-wrap"><div className="login-form"><h2>登录教学系统</h2><p className="topbar-meta">演示环境可选择角色后直接进入对应工作台。</p><div className="login-role-grid">{roles.map(r=><button type="button" key={r.key} className={`role-option ${role===r.key?"active":""}`} onClick={()=>setRole(r.key)}>{r.label}</button>)}</div><Form layout="vertical" onFinish={()=>router.push(`/${role}`)}><Form.Item label={role==="student"?"学号":"账号"} required><Input size="large" prefix={<UserOutlined />} defaultValue={role==="student"?"2024010215":"demo@cartography.edu.cn"} /></Form.Item><Form.Item label="密码" required><Input.Password size="large" prefix={<LockOutlined />} defaultValue="Demo@2026" /></Form.Item><Button htmlType="submit" type="primary" size="large" block>进入{roles.find(r=>r.key===role)?.label}端</Button></Form></div></section>
  </div>;
}
