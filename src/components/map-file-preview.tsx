"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Empty, Skeleton, Space, Tag } from "antd";
import { FilePdfOutlined, ReloadOutlined } from "@ant-design/icons";
import { getLatestSubmissionFile } from "@/lib/browser-submissions";

type PreviewState = {
  name: string;
  type: string;
  url: string;
} | null;

export function MapFilePreview() {
  const [preview, setPreview] = useState<PreviewState>(null);
  const [loading, setLoading] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    const file = await getLatestSubmissionFile();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = file ? URL.createObjectURL(file) : null;
    setPreview(file && objectUrlRef.current ? { name: file.name, type: file.type, url: objectUrlRef.current } : null);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void getLatestSubmissionFile().then((file) => {
      if (!active) return;
      objectUrlRef.current = file ? URL.createObjectURL(file) : null;
      setPreview(file && objectUrlRef.current ? { name: file.name, type: file.type, url: objectUrlRef.current } : null);
      setLoading(false);
    });
    return () => {
      active = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  if (loading) {
    return <div className="map-preview-loading"><Skeleton.Image active /><Skeleton active paragraph={{ rows: 3 }} /></div>;
  }

  if (!preview) {
    return (
      <div className="map-preview-empty">
        <Empty
          description={
            <div>
              <b>当前没有可预览的提交文件</b>
              <div className="review-copy">请先在学生端上传 PNG、JPG 或 PDF，再回到此页面查看。</div>
            </div>
          }
        >
          <Button icon={<ReloadOutlined />} onClick={() => void loadPreview()}>重新检查提交文件</Button>
        </Empty>
      </div>
    );
  }

  const isPdf = preview.type === "application/pdf" || preview.name.toLowerCase().endsWith(".pdf");
  return (
    <div className="map-file-preview">
      <div className="map-file-toolbar">
        <Space><Tag icon={isPdf ? <FilePdfOutlined /> : undefined}>{isPdf ? "PDF" : "图片"}</Tag><span>{preview.name}</span></Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadPreview()}>刷新预览</Button>
      </div>
      {isPdf
        ? <iframe title={preview.name} src={preview.url} className="map-pdf-frame" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={preview.url} alt={preview.name} className="map-image-preview" />}
    </div>
  );
}
