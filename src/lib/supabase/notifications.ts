import type { SessionProfile } from "@/lib/auth";
import { getAdminOverview } from "./admin-overview";
import { listStudentAssignments, listStudentSubmissions } from "./submission-data";
import { getTeacherOverview } from "./teacher-data";

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "info" | "warning" | "danger" | "success";
};

export type NotificationPayload = {
  count: number;
  notifications: AppNotification[];
};

export async function listNotifications(profile: SessionProfile): Promise<NotificationPayload> {
  if (profile.role === "teacher") {
    const overview = await getTeacherOverview(profile.id);
    const notifications: AppNotification[] = [];
    if (overview.pendingReviewCount > 0) {
      notifications.push({
        id: "teacher-pending-review",
        title: `${overview.pendingReviewCount} 份提交等待复评`,
        description: "进入 AI 审查与复评页面，确认形式审查结果或发布成绩。",
        href: "/teacher/review",
        tone: "warning",
      });
    }
    if (overview.aiFailedCount > 0) {
      notifications.push({
        id: "teacher-ai-failed",
        title: `${overview.aiFailedCount} 份 AI 审查失败`,
        description: "可以重新审查，或直接进行人工复评。",
        href: "/teacher/review",
        tone: "danger",
      });
    }
    if (overview.returnedCount > 0) {
      notifications.push({
        id: "teacher-returned",
        title: `${overview.returnedCount} 份作业已退回修改`,
        description: "学生重新提交后会生成新版本，请及时跟进。",
        href: "/teacher/review",
        tone: "info",
      });
    }
    if (overview.assignmentCount === 0) {
      notifications.push({
        id: "teacher-no-assignment",
        title: "还没有创建作业",
        description: "创建作业后，学生端才能看到可提交任务。",
        href: "/teacher/assignments",
        tone: "info",
      });
    }
    return { count: notifications.length, notifications };
  }

  if (profile.role === "student") {
    const [assignments, submissions] = await Promise.all([
      listStudentAssignments(profile.id),
      listStudentSubmissions(profile.id),
    ]);
    const pendingSubmit = assignments.filter((item) => item.canSubmit && !item.submission).length;
    const returned = assignments.filter((item) => item.submission?.status === "returned").length;
    const graded = submissions.filter((item) => item.grades?.length).length;
    const notifications: AppNotification[] = [];
    if (returned > 0) {
      notifications.push({
        id: "student-returned",
        title: `${returned} 份作业需要修改`,
        description: "查看教师退回原因后上传新的地图版本。",
        href: "/student",
        tone: "warning",
      });
    }
    if (pendingSubmit > 0) {
      notifications.push({
        id: "student-pending-submit",
        title: `${pendingSubmit} 份作业待提交`,
        description: "请在截止时间前上传地图作业。",
        href: "/student",
        tone: "info",
      });
    }
    if (graded > 0) {
      notifications.push({
        id: "student-graded",
        title: `${graded} 份成绩已发布`,
        description: "可以查看最终成绩和教师反馈。",
        href: "/student/grades",
        tone: "success",
      });
    }
    return { count: notifications.length, notifications };
  }

  const overview = await getAdminOverview();
  const notifications: AppNotification[] = [];
  if (overview.todayAiCount > 0) {
    notifications.push({
      id: "admin-ai-today",
      title: `今日 ${overview.todayAiCount} 次 AI 调用`,
      description: `成功率 ${overview.todayAiSuccessRate}，可查看调用记录。`,
      href: "/admin/ai-jobs",
      tone: "info",
    });
  }
  if (overview.teacherCount === 0) {
    notifications.push({
      id: "admin-no-teacher",
      title: "还没有教师账号",
      description: "创建教师账号后，教师才能管理班级和作业。",
      href: "/admin/users",
      tone: "warning",
    });
  }
  return { count: notifications.length, notifications };
}
