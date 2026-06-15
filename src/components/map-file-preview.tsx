"use client";

import { Button, Empty, Skeleton, Space, Tag } from "antd";
import { FilePdfOutlined, ReloadOutlined } from "@ant-design/icons";

export function MapFilePreview({
  name,
  mimeType,
  url,
  loading = false,
  onRefresh,
}: {
  name?: string | null;
  mimeType?: string | null;
  url?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  if (loading) return <div className="map-preview-loading"><Skeleton.Image active /><Skeleton active paragraph={{ rows: 3 }} /></div>;
  if (!url) {
    return (
      <div className="map-preview-empty">
        <Empty description={<div><b>当前没有可预览的提交文件</b><div className="review-copy">请选择一条已经完成上传的学生提交。</div></div>}>
          {onRefresh && <Button icon={<ReloadOutlined />} onClick={onRefresh}>重新加载</Button>}
        </Empty>
      </div>
    );
  }
  const isPdf = mimeType === "application/pdf" || name?.toLowerCase().endsWith(".pdf");
  return (
    <div className="map-file-preview">
      <div className="map-file-toolbar">
        <Space><Tag icon={isPdf ? <FilePdfOutlined /> : undefined}>{isPdf ? "PDF" : "图片"}</Tag><span>{name}</span></Space>
        {onRefresh && <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>刷新预览</Button>}
      </div>
      {isPdf
        ? <iframe title={name ?? "地图 PDF"} src={url} className="map-pdf-frame" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={url} alt={name ?? "地图预览"} className="map-image-preview" />}
    </div>
  );
}
