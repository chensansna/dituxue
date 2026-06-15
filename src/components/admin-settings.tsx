"use client";

import { useState } from "react";
import { Alert, Button, Descriptions, Space, Tag, message } from "antd";
import { CheckCircleOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";

type SettingsStatus = {
  supabaseUrl: boolean;
  supabaseAnonKey: boolean;
  supabaseServiceKey: boolean;
  qwenApiKey: boolean;
  qwenBaseUrl: string;
  qwenModel: string;
  maxUploadMb: number;
};

function StatusTag({ configured }: { configured: boolean }) {
  return <Tag color={configured ? "green" : "red"}>{configured ? "已配置" : "未配置"}</Tag>;
}

export function AdminSettings({ status }: { status: SettingsStatus }) {
  const [testing, setTesting] = useState(false);

  async function testQwen() {
    setTesting(true);
    try {
      const response = await fetch("/api/qwen/health", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Qwen 连接失败");
      message.success(`Qwen 连接正常，当前模型：${result.model}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Qwen 连接失败");
    } finally {
      setTesting(false);
    }
  }

  const supabaseReady = status.supabaseUrl && status.supabaseAnonKey && status.supabaseServiceKey;

  return <>
    <div className="page-head">
      <div><h1>系统设置</h1><p>查看服务配置与运行规则。密钥仅通过 Vercel 环境变量管理，不在页面中显示。</p></div>
      <Button type="primary" icon={<ReloadOutlined />} loading={testing} onClick={() => void testQwen()}>测试 Qwen 连接</Button>
    </div>
    <Alert
      type={supabaseReady && status.qwenApiKey ? "success" : "warning"}
      showIcon
      message={supabaseReady && status.qwenApiKey ? "核心服务配置完整" : "部分环境变量尚未配置"}
      description="修改 Vercel 环境变量后，需要重新部署才能生效。"
      style={{ marginBottom: 18 }}
    />
    <div className="two-col">
      <section className="panel">
        <div className="panel-head"><span className="panel-title">服务连接</span><SafetyCertificateOutlined /></div>
        <div className="panel-body">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Supabase 项目地址"><StatusTag configured={status.supabaseUrl} /></Descriptions.Item>
            <Descriptions.Item label="Supabase 匿名访问密钥"><StatusTag configured={status.supabaseAnonKey} /></Descriptions.Item>
            <Descriptions.Item label="Supabase 服务端密钥"><StatusTag configured={status.supabaseServiceKey} /></Descriptions.Item>
            <Descriptions.Item label="Qwen API 密钥"><StatusTag configured={status.qwenApiKey} /></Descriptions.Item>
            <Descriptions.Item label="Qwen API 地址">{status.qwenBaseUrl}</Descriptions.Item>
            <Descriptions.Item label="Qwen 视觉模型">{status.qwenModel}</Descriptions.Item>
          </Descriptions>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><span className="panel-title">当前运行规则</span><CheckCircleOutlined /></div>
        <div className="panel-body">
          <div className="review-item"><b>地图文件</b><div className="review-copy">支持 PNG、JPG、PDF，单文件最大 {status.maxUploadMb} MB。</div></div>
          <div className="review-item"><b>Qwen 调用</b><div className="review-copy">仅教师主动点击单份或批量形式审查时调用，不自动运行。</div></div>
          <div className="review-item"><b>形式审查</b><div className="review-copy">只检查指北针、比例尺、图例和坐标格网，不参与成绩计算。</div></div>
          <div className="review-item"><b>文件与数据</b><div className="review-copy">地图存储于 Supabase 私有存储，学生只能访问自己的数据。</div></div>
        </div>
      </section>
    </div>
    <Space style={{ marginTop: 18 }}><Tag color="blue">配置修改位置：Vercel → Project Settings → Environment Variables</Tag></Space>
  </>;
}
