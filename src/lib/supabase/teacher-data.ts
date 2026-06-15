import { randomBytes } from "node:crypto";
import { studentEmail } from "@/lib/auth";
import { createSupabaseAdminClient } from "./admin";

export type TeacherClass = {
  id: string;
  name: string;
  term: string;
  createdAt: string;
  studentCount: number;
};

export type TeacherStudent = {
  id: string;
  studentNo: string;
  name: string;
  classId: string;
  className: string;
  state: string;
  submittedCount: number;
  averageScore: number | null;
  createdAt: string;
};

export type TeacherAssignment = {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  status: "draft" | "published" | "closed" | "archived";
  deadline: string;
  submittedCount: number;
  gradedCount: number;
  createdAt: string;
};

function initialPassword() {
  return `Map@${randomBytes(6).toString("base64url")}`;
}

async function findUserByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function ensureDefaultClass(teacherId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("classes")
    .select("id")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .limit(1);
  if (error) throw error;
  if (data.length) return;
  const inserted = await admin.from("classes").insert({
    teacher_id: teacherId,
    name: "地图学 2024-1班",
    term: "2025-2026 第二学期",
  });
  if (inserted.error) throw inserted.error;
}

export async function ensureTeacherWorkspace(teacherId: string) {
  await ensureDefaultClass(teacherId);
}

export async function listClasses(teacherId: string): Promise<TeacherClass[]> {
  await ensureTeacherWorkspace(teacherId);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("classes")
    .select("id,name,term,created_at,class_members(student_id)")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((item) => ({
    id: item.id,
    name: item.name,
    term: item.term,
    createdAt: item.created_at,
    studentCount: item.class_members?.length ?? 0,
  }));
}

export async function createClass(teacherId: string, input: { name: string; term?: string }) {
  await ensureTeacherWorkspace(teacherId);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("classes").insert({
    teacher_id: teacherId,
    name: input.name,
    term: input.term || "2025-2026 第二学期",
  });
  if (error) throw error;
}

export async function archiveClass(teacherId: string, classId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("classes").update({ deleted_at: new Date().toISOString() }).eq("id", classId).eq("teacher_id", teacherId);
  if (error) throw error;
}

export async function listStudents(teacherId: string): Promise<TeacherStudent[]> {
  const classes = await listClasses(teacherId);
  const classMap = new Map(classes.map((item) => [item.id, item.name]));
  const admin = createSupabaseAdminClient();
  const classIds = classes.map((item) => item.id);
  if (!classIds.length) return [];
  const { data: members, error } = await admin
    .from("class_members")
    .select("class_id,student_id")
    .in("class_id", classIds);
  if (error) throw error;
  const studentIds = [...new Set((members ?? []).map((member) => member.student_id).filter(Boolean))];
  if (!studentIds.length) return [];

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id,student_no,display_name,disabled_at,created_at")
    .in("id", studentIds);
  if (profileError) throw profileError;
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const { data: submissions, error: submissionError } = await admin
    .from("submissions")
    .select("student_id,grades(final_score)")
    .in("student_id", studentIds);
  if (submissionError) throw submissionError;

  const stats = new Map<string, { submitted: number; scores: number[] }>();
  for (const submission of submissions ?? []) {
    const current = stats.get(submission.student_id) ?? { submitted: 0, scores: [] };
    current.submitted += 1;
    const grade = Array.isArray(submission.grades) ? submission.grades[0] : submission.grades;
    if (grade?.final_score !== undefined && grade?.final_score !== null) current.scores.push(Number(grade.final_score));
    stats.set(submission.student_id, current);
  }

  return (members ?? [])
    .map((member) => ({ member, profile: profileMap.get(member.student_id) }))
    .filter((item) => item.profile)
    .map((member) => {
      const profile = member.profile!;
      const itemStats = stats.get(profile.id);
      const averageScore = itemStats?.scores.length
        ? Math.round((itemStats.scores.reduce((sum, score) => sum + score, 0) / itemStats.scores.length) * 10) / 10
        : null;
      return {
        id: profile.id,
        studentNo: profile.student_no ?? "",
        name: profile.display_name,
        classId: member.member.class_id,
        className: classMap.get(member.member.class_id) ?? "未分班",
        state: profile.disabled_at ? "已停用" : "正常",
        submittedCount: itemStats?.submitted ?? 0,
        averageScore,
        createdAt: profile.created_at,
      };
    })
    .sort((a, b) => a.studentNo.localeCompare(b.studentNo));
}

export async function addStudent(teacherId: string, input: { classId: string; studentNo: string; name: string }) {
  const classes = await listClasses(teacherId);
  if (!classes.some((item) => item.id === input.classId)) throw new Error("班级不属于当前教师");
  const admin = createSupabaseAdminClient();
  const email = studentEmail(input.studentNo);
  let user = await findUserByEmail(email);
  const password = initialPassword();
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: input.name, student_no: input.studentNo },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error("Failed to create student.");
    user = created.data.user;
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: { display_name: input.name, student_no: input.studentNo },
    });
    if (updated.error) throw updated.error;
  }
  const profile = await admin.from("profiles").upsert({
    id: user.id,
    role: "student",
    student_no: input.studentNo,
    display_name: input.name,
    must_change_password: true,
    disabled_at: null,
  });
  if (profile.error) throw profile.error;
  const member = await admin.from("class_members").upsert({ class_id: input.classId, student_id: user.id });
  if (member.error) throw member.error;
  return { studentNo: input.studentNo, name: input.name, password };
}

export async function disableStudent(teacherId: string, studentId: string) {
  const students = await listStudents(teacherId);
  if (!students.some((item) => item.id === studentId)) throw new Error("学生不属于当前教师");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").update({ disabled_at: new Date().toISOString() }).eq("id", studentId);
  if (error) throw error;
}

export async function listAssignments(teacherId: string): Promise<TeacherAssignment[]> {
  const classes = await listClasses(teacherId);
  const classMap = new Map(classes.map((item) => [item.id, item.name]));
  const admin = createSupabaseAdminClient();
  const classIds = classes.map((item) => item.id);
  if (!classIds.length) return [];
  const { data, error } = await admin
    .from("assignments")
    .select("id,title,description,class_id,status,deadline,created_at,submissions(id,grades(final_score))")
    .in("class_id", classIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    classId: item.class_id,
    className: classMap.get(item.class_id) ?? "未分班",
    status: item.status,
    deadline: item.deadline,
    submittedCount: item.submissions?.length ?? 0,
    gradedCount: item.submissions?.filter((submission) => {
      const grade = Array.isArray(submission.grades) ? submission.grades[0] : submission.grades;
      return grade?.final_score !== undefined && grade?.final_score !== null;
    }).length ?? 0,
    createdAt: item.created_at,
  }));
}

export async function createAssignment(input: {
  teacherId: string;
  title: string;
  description?: string;
  classIds: string[];
  status: "draft" | "published";
  deadline?: string | null;
}) {
  const classes = await listClasses(input.teacherId);
  const allowed = new Set(classes.map((item) => item.id));
  if (input.classIds.some((classId) => !allowed.has(classId))) throw new Error("存在不属于当前教师的班级");
  const admin = createSupabaseAdminClient();
  const deadline = input.deadline ?? "2099-12-31T15:59:59.000Z";
  const rows = input.classIds.map((classId) => ({
    class_id: classId,
    title: input.title,
    description: input.description ?? "",
    status: input.status,
    publish_at: input.status === "published" ? new Date().toISOString() : null,
    deadline,
  }));
  const { error } = await admin.from("assignments").insert(rows);
  if (error) throw error;
}

export async function listStatistics(teacherId: string) {
  const [classes, students, assignments] = await Promise.all([listClasses(teacherId), listStudents(teacherId), listAssignments(teacherId)]);
  const ranked = [...students]
    .filter((student) => student.averageScore !== null)
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))
    .map((student, index) => ({ ...student, rank: index + 1 }));
  const average = ranked.length
    ? Math.round((ranked.reduce((sum, student) => sum + (student.averageScore ?? 0), 0) / ranked.length) * 10) / 10
    : null;
  return {
    classes,
    students,
    assignments,
    ranked,
    summary: {
      classCount: classes.length,
      studentCount: students.length,
      assignmentCount: assignments.length,
      averageScore: average,
      gradedStudentCount: ranked.length,
    },
  };
}
