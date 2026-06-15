"use client";

import { Button, Empty, Input, Space, Tag } from "antd";
import { DownloadOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";

export function ModulePlaceholder({ title, description, role }: { title: string; description: string; role: string }) {
  return <><div className="page-head"><div><h1>{title}</h1><p>{description}</p></div><Space wrap><Button icon={<DownloadOutlined />}>导出结果</Button><Button type="primary" icon={<PlusOutlined />}>新建记录</Button></Space></div><section className="panel"><div className="panel-head"><Input prefix={<SearchOutlined />} placeholder="搜索名称、学号或状态" style={{maxWidth:320}} /><Tag color="green">{role}权限已启用</Tag></div><div className="empty-hint"><Empty description="该模块已完成路由与权限骨架，连接 Supabase 后显示真实数据" /></div></section></>;
}
