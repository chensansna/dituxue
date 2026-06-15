import { randomUUID } from "node:crypto";
import type { AppRole } from "@/lib/auth";
import { HttpError } from "@/lib/auth";
import { reviewResultSchema, type SubmissionStatus } from "@/lib/domain";
import { reviewMap } from "@/lib/qwen";
import { createSupabaseAdminClient } from "./admin";

export const MAP_BUCKET = "map-submissions";
export const MAX_MAP_FILE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_MAP_TYPES = ["image/png", "image/jpeg", "application/pdf"] as const;
export const FORMAL_CHECKS = [
  { id: "north_arrow", title: "指北针" },
  { id: "scale_bar", title: "比例尺" },
  { id: "legend", title: "图例" },
  { id: "coordinate_grid", title: "坐标格网" },
] as const;

export function validateMapFileMetadata(mimeType: string, sizeBytes: number) {
  if (!ALLOWED_MAP_TYPES.includes(mimeType as typeof ALLOWED_MAP_TYPES[number])) throw new HttpError(400, "仅支持 PNG、JPG、PDF");
  if (sizeBytes <= 0 || sizeBytes > MAX_MAP_FILE_BYTES) throw new HttpError(400, "文件大小必须在 50MB 以内");
}

type Actor = { id: string; role: AppRole };
type UploadInput = {
  assignmentId: string;
  studentId?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function relationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function safeFileName(name: string) {
  const rawExtension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const extension = /^[a-z0-9]{1,10}$/.test(rawExtension) ? `.${rawExtension}` : "";
  return `map-${randomUUID()}${extension}`;
}

function audit(actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const admin = createSupabaseAdminClient();
  return admin.from("audit_logs").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, metadata });
}

async function storageObjectToDataUrl(path: string, mimeType: string) {
  const admin = createSupabaseAdminClient();
  const signed = await admin.storage.from(MAP_BUCKET).createSignedUrl(path, 900);
  if (signed.error) throw signed.error;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = baseUrl ? new URL(signed.data.signedUrl, baseUrl).toString() : signed.data.signedUrl;
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(502, "无法读取已上传的地图文件，请重新上传后再审查");
  const arrayBuffer = await response.arrayBuffer();
  return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
}

async function getAssignmentContext(assignmentId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("assignments")
    .select("id,title,status,deadline,class_id,classes(id,name,teacher_id)")
    .eq("id", assignmentId)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new HttpError(404, "作业不存在");
  return { ...data, class: singleRelation(data.classes) };
}

async function ensureClassMember(classId: string, studentId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("class_members").select("student_id").eq("class_id", classId).eq("student_id", studentId).maybeSingle();
  if (error || !data) throw new HttpError(403, "学生不属于该班级");
}

async function ensureSubmissionAccess(actor: Actor, submissionId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select("id,assignment_id,student_id,status,current_version,assignments(id,title,class_id,classes(id,name,teacher_id)),profiles!submissions_student_id_fkey(id,display_name,student_no)")
    .eq("id", submissionId)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new HttpError(404, "提交记录不存在");
  const assignment = singleRelation(data.assignments);
  const classroom = singleRelation(assignment?.classes);
  if (actor.role === "student" && data.student_id !== actor.id) throw new HttpError(403, "无权访问该提交");
  if (actor.role === "teacher" && classroom?.teacher_id !== actor.id) throw new HttpError(403, "无权访问该提交");
  if (actor.role !== "student" && actor.role !== "teacher" && actor.role !== "admin") throw new HttpError(403, "无权访问该提交");
  return { ...data, assignment, classroom, student: singleRelation(data.profiles) };
}

export async function prepareSubmission(actor: Actor, input: UploadInput) {
  validateMapFileMetadata(input.mimeType, input.sizeBytes);
  const assignment = await getAssignmentContext(input.assignmentId);
  const targetStudentId = actor.role === "student" ? actor.id : input.studentId;
  if (!targetStudentId) throw new HttpError(400, "请选择学生");
  if (actor.role === "teacher" && assignment.class?.teacher_id !== actor.id) throw new HttpError(403, "作业不属于当前教师");
  if (actor.role === "student") {
    if (assignment.status !== "published") throw new HttpError(400, "当前作业不可提交");
    await ensureClassMember(assignment.class_id, actor.id);
    const admin = createSupabaseAdminClient();
    const { data: extension } = await admin.from("extensions").select("extended_deadline").eq("assignment_id", assignment.id).eq("student_id", actor.id).maybeSingle();
    const effectiveDeadline = extension?.extended_deadline ?? assignment.deadline;
    if (new Date() > new Date(effectiveDeadline)) throw new HttpError(400, "作业已超过截止时间");
  } else {
    await ensureClassMember(assignment.class_id, targetStudentId);
  }

  const admin = createSupabaseAdminClient();
  const { data: versionRows, error: versionError } = await admin.rpc("create_submission_version", {
    target_assignment: assignment.id,
    target_student: targetStudentId,
    actor: actor.id,
    actor_is_teacher: actor.role === "teacher",
  });
  if (versionError || !versionRows?.length) throw versionError ?? new Error("创建提交版本失败");
  const version = versionRows[0];
  const pendingUpload = await admin.from("submissions").update({ status: "ai_processing", updated_at: new Date().toISOString() }).eq("id", version.submission_id);
  if (pendingUpload.error) throw pendingUpload.error;
  const fileName = safeFileName(input.originalName);
  const root = `${targetStudentId}/${version.submission_id}/${version.version_id}`;
  const originalPath = `${root}/original/${fileName}`;
  const previewPath = input.mimeType === "application/pdf" ? `${root}/preview/page-1.jpg` : null;
  const originalUpload = await admin.storage.from(MAP_BUCKET).createSignedUploadUrl(originalPath);
  if (originalUpload.error) throw originalUpload.error;
  const previewUpload = previewPath ? await admin.storage.from(MAP_BUCKET).createSignedUploadUrl(previewPath) : null;
  if (previewUpload?.error) throw previewUpload.error;
  await audit(actor.id, version.version_no === 1 ? "submission.created" : "submission.resubmitted", "submission", version.submission_id, {
    versionId: version.version_id,
    versionNo: version.version_no,
    submittedByTeacher: actor.role === "teacher",
  });
  return {
    submissionId: version.submission_id,
    versionId: version.version_id,
    versionNo: version.version_no,
    originalPath,
    previewPath,
    originalUpload: originalUpload.data,
    previewUpload: previewUpload?.data ?? null,
  };
}

export async function completeSubmission(actor: Actor, input: {
  submissionId: string;
  versionId: string;
  originalPath: string;
  previewPath?: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const submission = await ensureSubmissionAccess(actor, input.submissionId);
  const admin = createSupabaseAdminClient();
  const { data: version, error: versionError } = await admin.from("submission_versions").select("id").eq("id", input.versionId).eq("submission_id", input.submissionId).single();
  if (versionError || !version) throw new HttpError(404, "提交版本不存在");
  const expectedPrefix = `${submission.student_id}/${input.submissionId}/${input.versionId}/`;
  if (!input.originalPath.startsWith(expectedPrefix) || (input.previewPath && !input.previewPath.startsWith(expectedPrefix))) throw new HttpError(400, "文件路径无效");
  validateMapFileMetadata(input.mimeType, input.sizeBytes);
  const originalSegments = input.originalPath.split("/");
  const originalName = originalSegments.pop()!;
  const originalFolder = originalSegments.join("/");
  const originalObjects = await admin.storage.from(MAP_BUCKET).list(originalFolder, { search: originalName, limit: 1 });
  if (originalObjects.error || !originalObjects.data.some((item) => item.name === originalName)) throw new HttpError(400, "原始文件尚未上传完成");
  if (input.previewPath) {
    const previewSegments = input.previewPath.split("/");
    const previewName = previewSegments.pop()!;
    const previewFolder = previewSegments.join("/");
    const previewObjects = await admin.storage.from(MAP_BUCKET).list(previewFolder, { search: previewName, limit: 1 });
    if (previewObjects.error || !previewObjects.data.some((item) => item.name === previewName)) throw new HttpError(400, "PDF 第一页预览尚未上传完成");
  }
  const { error } = await admin.from("files").upsert({
    version_id: input.versionId,
    storage_path: input.originalPath,
    original_name: input.originalName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    preview_paths: input.previewPath ? [input.previewPath] : [],
  }, { onConflict: "version_id" });
  if (error) throw error;
  await admin.from("submissions").update({ status: "pending_teacher_review", updated_at: new Date().toISOString() }).eq("id", input.submissionId);
  await audit(actor.id, "submission.upload_completed", "submission", input.submissionId, { versionId: input.versionId });
  return { ok: true };
}

export async function createFileSignedUrl(actor: Actor, fileId: string, preferPreview = false) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("files").select("id,version_id,storage_path,preview_paths,original_name,mime_type,submission_versions(submission_id)").eq("id", fileId).single();
  if (error || !data) throw new HttpError(404, "文件不存在");
  const version = singleRelation(data.submission_versions);
  if (!version) throw new HttpError(404, "文件版本不存在");
  await ensureSubmissionAccess(actor, version.submission_id);
  const path = preferPreview && data.preview_paths?.[0] ? data.preview_paths[0] : data.storage_path;
  const signed = await admin.storage.from(MAP_BUCKET).createSignedUrl(path, 600);
  if (signed.error) throw signed.error;
  return { url: signed.data.signedUrl, name: data.original_name, mimeType: preferPreview && data.preview_paths?.[0] ? "image/jpeg" : data.mime_type };
}

export async function listStudentAssignments(studentId: string) {
  const admin = createSupabaseAdminClient();
  const { data: memberships, error: memberError } = await admin.from("class_members").select("class_id,classes(name)").eq("student_id", studentId);
  if (memberError) throw memberError;
  const classIds = (memberships ?? []).map((item) => item.class_id);
  if (!classIds.length) return [];
  const classNames = new Map((memberships ?? []).map((item) => [item.class_id, singleRelation(item.classes)?.name ?? "未分班"]));
  const { data: assignments, error } = await admin.from("assignments")
    .select("id,title,description,class_id,status,deadline,extensions(student_id,extended_deadline,reason),submissions(id,student_id,status,current_version,returned_reason,teacher_feedback,submission_versions(version_no,files(id)),grades(final_score,feedback,published_at))")
    .in("class_id", classIds).neq("status", "draft").is("deleted_at", null).order("deadline");
  if (error) throw error;
  return (assignments ?? []).map((assignment) => {
    const candidate = (assignment.submissions ?? []).find((item) => item.student_id === studentId) ?? null;
    const currentVersion = candidate?.submission_versions?.find((version) => version.version_no === candidate.current_version);
    const submission = singleRelation(currentVersion?.files) ? candidate : null;
    const extension = (assignment.extensions ?? []).find((item) => item.student_id === studentId) ?? null;
    const grade = singleRelation(submission?.grades);
    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      className: classNames.get(assignment.class_id) ?? "未分班",
      deadline: extension?.extended_deadline ?? assignment.deadline,
      extensionReason: extension?.reason ?? null,
      submission: submission ? {
        ...submission,
        teacher_feedback: ["returned", "reviewed", "graded"].includes(submission.status) ? submission.teacher_feedback : null,
      } : null,
      grade: grade?.published_at ? grade : null,
      canSubmit: assignment.status === "published" && new Date() <= new Date(extension?.extended_deadline ?? assignment.deadline),
    };
  });
}

export async function listStudentSubmissions(studentId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("submissions")
    .select("id,status,current_version,returned_reason,teacher_feedback,updated_at,assignments(title),submission_versions(id,version_no,submitted_by_teacher,created_at,files(id,original_name,mime_type,size_bytes),review_results(id,raw_result,overall_suggestion,visible_to_student,confirmed_at)),grades(final_score,feedback,published_at)")
    .eq("student_id", studentId).is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((submission) => {
    const completedVersions = (submission.submission_versions ?? []).filter((version) => singleRelation(version.files)).map((version) => ({
      ...version,
      files: relationArray(version.files),
      review_results: relationArray(version.review_results).filter((review) => review.visible_to_student),
    }));
    if (!completedVersions.length) return [];
    return [{
      ...submission,
      teacher_feedback: ["returned", "reviewed", "graded"].includes(submission.status) ? submission.teacher_feedback : null,
      grades: relationArray(submission.grades).filter((grade) => grade.published_at),
      submission_versions: completedVersions,
    }];
  });
}

export async function listPublishedGrades(studentId: string) {
  const submissions = await listStudentSubmissions(studentId);
  return submissions.flatMap((submission) => {
    const grade = singleRelation(submission.grades);
    if (!grade?.published_at) return [];
    return [{ ...grade, submissionId: submission.id, assignmentTitle: singleRelation(submission.assignments)?.title ?? "地图作业", teacherFeedback: submission.teacher_feedback }];
  });
}

export async function listTeacherReviewQueue(teacherId: string) {
  const admin = createSupabaseAdminClient();
  const { data: classes, error: classError } = await admin.from("classes").select("id,name").eq("teacher_id", teacherId).is("deleted_at", null);
  if (classError) throw classError;
  const classIds = (classes ?? []).map((item) => item.id);
  if (!classIds.length) return [];
  const classNames = new Map((classes ?? []).map((item) => [item.id, item.name]));
  const { data: assignmentRows, error: assignmentError } = await admin.from("assignments").select("id").in("class_id", classIds);
  if (assignmentError) throw assignmentError;
  const assignmentIds = (assignmentRows ?? []).map((item) => item.id);
  if (!assignmentIds.length) return [];
  const { data, error } = await admin.from("submissions")
    .select("id,status,current_version,updated_at,student_id,profiles!submissions_student_id_fkey(display_name,student_no),assignments(id,title,class_id),submission_versions(id,version_no,files(id,original_name,mime_type),review_results(id))")
    .in("assignment_id", assignmentIds)
    .is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((item) => {
    const assignment = singleRelation(item.assignments);
    const student = singleRelation(item.profiles);
    const latestVersion = (item.submission_versions ?? []).find((version) => version.version_no === item.current_version);
    const file = singleRelation(latestVersion?.files);
    const review = singleRelation(latestVersion?.review_results);
    if (!file) return [];
    return [{
      id: item.id,
      status: item.status,
      updatedAt: item.updated_at,
      assignmentId: assignment?.id,
      assignmentTitle: assignment?.title ?? "地图作业",
      className: classNames.get(assignment?.class_id ?? "") ?? "未分班",
      studentName: student?.display_name ?? "学生",
      studentNo: student?.student_no ?? "",
      fileName: file?.original_name ?? null,
      hasReview: Boolean(review),
    }];
  });
}

export async function getTeacherReviewDetail(teacherId: string, submissionId: string) {
  const submission = await ensureSubmissionAccess({ id: teacherId, role: "teacher" }, submissionId);
  const admin = createSupabaseAdminClient();
  const { data: versions, error } = await admin.from("submission_versions")
    .select("id,version_no,submitted_by_teacher,created_at,files(id,original_name,mime_type,size_bytes),review_results(id,raw_result,overall_suggestion,confidence,visible_to_student,confirmed_at,review_corrections(check_key,teacher_value))")
    .eq("submission_id", submissionId).order("version_no", { ascending: false });
  if (error) throw error;
  const { data: grade } = await admin.from("grades").select("final_score,feedback,published_at").eq("submission_id", submissionId).maybeSingle();
  return {
    submission,
    versions: (versions ?? []).map((version) => ({
      ...version,
      files: relationArray(version.files),
      review_results: relationArray(version.review_results).map((review) => ({
        ...review,
        review_corrections: relationArray(review.review_corrections),
      })),
    })),
    grade,
  };
}

export async function runTeacherAiReview(teacherId: string, submissionId: string) {
  const detail = await getTeacherReviewDetail(teacherId, submissionId);
  const latest = detail.versions.find((item) => item.version_no === detail.submission.current_version);
  const file = singleRelation(latest?.files);
  if (!latest || !file) throw new HttpError(400, "当前版本没有地图文件");
  const admin = createSupabaseAdminClient();
  const { data: fileRow } = await admin.from("files").select("storage_path,preview_paths").eq("id", file.id).single();
  const reviewPath = fileRow?.preview_paths?.[0] ?? fileRow?.storage_path;
  if (!reviewPath) throw new HttpError(400, "没有可供审查的图片");
  if (file.mime_type === "application/pdf" && !fileRow?.preview_paths?.[0]) throw new HttpError(400, "PDF 缺少第一页预览图，请重新提交");
  const imageForReview = await storageObjectToDataUrl(reviewPath, fileRow?.preview_paths?.[0] ? "image/jpeg" : file.mime_type);
  const startedAt = Date.now();
  const { data: job, error: jobError } = await admin.from("ai_jobs").insert({
    kind: "map_review",
    model: process.env.QWEN_VISION_MODEL ?? "qwen3-vl-plus",
    status: "processing",
    requested_by: teacherId,
    version_id: latest.id,
  }).select("id").single();
  if (jobError || !job) throw jobError ?? new Error("创建 AI 任务失败");
  try {
    const result = reviewResultSchema.parse(await reviewMap(imageForReview, FORMAL_CHECKS.map((item) => ({ ...item }))));
    const { data: review, error } = await admin.from("review_results").upsert({
      version_id: latest.id,
      ai_job_id: job.id,
      raw_result: result,
      overall_suggestion: result.summary,
      confidence: result.confidence,
      visible_to_student: false,
      confirmed_by: null,
      confirmed_at: null,
    }, { onConflict: "version_id" }).select("id").single();
    if (error) throw error;
    await admin.from("ai_jobs").update({ status: "completed", completed_count: 1, duration_ms: Date.now() - startedAt, updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("submissions").update({ status: "pending_teacher_review", updated_at: new Date().toISOString() }).eq("id", submissionId);
    await audit(teacherId, "review.ai_completed", "submission", submissionId, { reviewResultId: review?.id, versionId: latest.id });
    return result;
  } catch (error) {
    await admin.from("ai_jobs").update({ status: "failed", error_message: error instanceof Error ? error.message.slice(0, 500) : "Qwen 审查失败", duration_ms: Date.now() - startedAt, updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("submissions").update({ status: "ai_failed", updated_at: new Date().toISOString() }).eq("id", submissionId);
    throw error;
  }
}

export async function saveTeacherReview(teacherId: string, submissionId: string, input: {
  action: "draft" | "returned" | "reviewed" | "graded";
  score?: number | null;
  feedback: string;
  returnedReason?: string;
  items: Array<{ rubricId: string; present: boolean; evidence: string }>;
}) {
  const detail = await getTeacherReviewDetail(teacherId, submissionId);
  const latest = detail.versions.find((item) => item.version_no === detail.submission.current_version);
  const review = singleRelation(latest?.review_results);
  if (!latest || !review) throw new HttpError(400, "请先完成 Qwen 形式审查");
  if (input.action === "graded" && (input.score === null || input.score === undefined)) throw new HttpError(400, "发布成绩前请填写教师评分");
  const admin = createSupabaseAdminClient();
  const raw = reviewResultSchema.parse(review.raw_result);
  const corrections = input.items.filter((item) => {
    const ai = raw.items.find((entry) => entry.rubricId === item.rubricId);
    return ai && (ai.present !== item.present || ai.evidence !== item.evidence);
  }).map((item) => ({
    review_result_id: review.id,
    rubric_item_id: null,
    check_key: item.rubricId,
    ai_value: raw.items.find((entry) => entry.rubricId === item.rubricId),
    teacher_value: item,
    corrected_by: teacherId,
  }));
  await admin.from("review_corrections").delete().eq("review_result_id", review.id).not("check_key", "is", null);
  if (corrections.length) {
    const corrected = await admin.from("review_corrections").insert(corrections);
    if (corrected.error) throw corrected.error;
  }
  const visible = input.action !== "draft";
  await admin.from("review_results").update({ visible_to_student: visible, confirmed_by: visible ? teacherId : null, confirmed_at: visible ? new Date().toISOString() : null }).eq("id", review.id);
  const statusMap: Record<typeof input.action, SubmissionStatus> = { draft: "pending_teacher_review", returned: "returned", reviewed: "reviewed", graded: "graded" };
  await admin.from("submissions").update({
    status: statusMap[input.action],
    teacher_feedback: input.feedback,
    returned_reason: input.action === "returned" ? input.returnedReason || input.feedback : null,
    updated_at: new Date().toISOString(),
  }).eq("id", submissionId);
  if (input.action === "graded") {
    await admin.from("grades").upsert({
      submission_id: submissionId,
      final_score: input.score,
      feedback: input.feedback,
      published_at: new Date().toISOString(),
      published_by: teacherId,
      updated_at: new Date().toISOString(),
    });
  } else {
    await admin.from("grades").delete().eq("submission_id", submissionId);
  }
  await audit(teacherId, `review.${input.action}`, "submission", submissionId, { reviewResultId: review.id, score: input.score ?? null });
  return { ok: true };
}
