import { createSupabaseBrowserClient } from "./supabase/client";

type PreparedUpload = {
  submissionId: string;
  versionId: string;
  versionNo: number;
  originalPath: string;
  previewPath: string | null;
  originalUpload: { path: string; token: string };
  previewUpload: { path: string; token: string } | null;
};

async function pdfFirstPage(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法生成 PDF 预览");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(new File([blob], "page-1.jpg", { type: "image/jpeg" })) : reject(new Error("无法生成 PDF 预览")), "image/jpeg", 0.9);
  });
}

export async function uploadSubmissionFile(assignmentId: string, file: File, studentId?: string) {
  const preparedResponse = await fetch("/api/submissions/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assignmentId,
      studentId,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const prepared = await preparedResponse.json() as PreparedUpload & { error?: string };
  if (!preparedResponse.ok) throw new Error(prepared.error ?? "准备上传失败");
  const supabase = createSupabaseBrowserClient();
  const original = await supabase.storage.from("map-submissions").uploadToSignedUrl(prepared.originalUpload.path, prepared.originalUpload.token, file, {
    contentType: file.type,
  });
  if (original.error) throw original.error;
  if (file.type === "application/pdf" && prepared.previewUpload) {
    const preview = await pdfFirstPage(file);
    const uploadedPreview = await supabase.storage.from("map-submissions").uploadToSignedUrl(prepared.previewUpload.path, prepared.previewUpload.token, preview, {
      contentType: "image/jpeg",
    });
    if (uploadedPreview.error) throw uploadedPreview.error;
  }
  const completed = await fetch("/api/submissions/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submissionId: prepared.submissionId,
      versionId: prepared.versionId,
      originalPath: prepared.originalPath,
      previewPath: prepared.previewPath,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const result = await completed.json();
  if (!completed.ok) throw new Error(result.error ?? "确认上传失败");
  return prepared;
}
