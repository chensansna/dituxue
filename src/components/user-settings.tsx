"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Button, Card, Form, Input, message, Modal, Select, Space, Tabs, Tag } from "antd";
import { LockOutlined, ReloadOutlined, SaveOutlined, UserOutlined } from "@ant-design/icons";

type UserRole = "teacher" | "student";

type ProfileSettings = {
  displayName: string;
  honorific: string;
  avatarColor: string;
  themeMode: "light" | "dark";
  themeColor: "green" | "blue" | "purple" | "slate";
};

type ProfileFormValues = {
  displayName: string;
  honorific: string;
};

type StudentItem = {
  id: string;
  studentNo: string;
  name: string;
  className: string;
  state: string;
};

type Credential = {
  studentNo: string;
  name: string;
  password: string;
};

const defaultProfile: ProfileSettings = {
  displayName: "",
  honorific: "",
  avatarColor: "#176b4d",
  themeMode: "light",
  themeColor: "green",
};

export function UserSettings({ role }: { role: UserRole }) {
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [passwordForm] = Form.useForm<{ password: string; confirm: string }>();
  const [studentForm] = Form.useForm<{ studentId: string }>();
  const [profile, setProfile] = useState<ProfileSettings>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [credential, setCredential] = useState<Credential | null>(null);

  const initials = useMemo(() => (profile.displayName || "用户").slice(0, 1), [profile.displayName]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/profile/settings", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "设置加载失败");
      const nextProfile: ProfileSettings = {
        displayName: result.profile.displayName,
        honorific: result.profile.honorific ?? "",
        avatarColor: result.profile.avatarColor ?? defaultProfile.avatarColor,
        themeMode: result.profile.themeMode ?? defaultProfile.themeMode,
        themeColor: result.profile.themeColor ?? defaultProfile.themeColor,
      };
      setProfile(nextProfile);
      profileForm.setFieldsValue({
        displayName: nextProfile.displayName,
        honorific: nextProfile.honorific,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "设置加载失败");
    } finally {
      setLoading(false);
    }
  }, [profileForm]);

  const loadStudents = useCallback(async () => {
    if (role !== "teacher") return;
    try {
      const response = await fetch("/api/teacher/students", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "学生列表加载失败");
      setStudents(result.students ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "学生列表加载失败");
    }
  }, [role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSettings();
      void loadStudents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings, loadStudents]);

  async function saveProfile(values: ProfileFormValues) {
    const payload: ProfileSettings = {
      ...profile,
      displayName: values.displayName,
      honorific: values.honorific ?? "",
      avatarColor: defaultProfile.avatarColor,
      themeMode: defaultProfile.themeMode,
      themeColor: defaultProfile.themeColor,
    };
    setSavingProfile(true);
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "保存失败");
      setProfile(payload);
      message.success("个人信息已保存");
      window.dispatchEvent(new CustomEvent("profile-settings-updated"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(values: { password: string; confirm: string }) {
    if (values.password !== values.confirm) {
      message.error("两次输入的新密码不一致");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "修改失败");
      passwordForm.resetFields();
      message.success("密码已更新");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "修改失败");
    } finally {
      setChangingPassword(false);
    }
  }

  async function resetStudentPassword(values: { studentId: string }) {
    setResettingPassword(true);
    try {
      const response = await fetch("/api/teacher/students/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "重置失败");
      setCredential(result.credential);
      studentForm.resetFields();
      message.success("学生密码已重置");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "重置失败");
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{role === "teacher" ? "教师端设置" : "学生端设置"}</h1>
          <p>管理个人信息和账号安全；设置会保存到 Supabase。</p>
        </div>
      </div>

      <Tabs
        className="settings-tabs"
        items={[
          {
            key: "profile",
            label: "个人信息",
            children: (
              <Card className="settings-card" loading={loading}>
                <div className="settings-profile-preview is-simple">
                  <Avatar size={64} style={{ background: "#176b4d" }}>{initials}</Avatar>
                  <div>
                    <h2>{profile.displayName || "未命名用户"}</h2>
                    <p>{role === "teacher" ? profile.honorific || "教师" : "学生"}</p>
                  </div>
                </div>
                <Form
                  form={profileForm}
                  layout="vertical"
                  onValuesChange={(_, values) => {
                    setProfile((current) => ({ ...current, ...values }));
                  }}
                  onFinish={(values) => void saveProfile(values)}
                >
                  <Form.Item name="displayName" label={role === "teacher" ? "姓名" : "昵称"} rules={[{ required: true, message: "请输入名称" }]}>
                    <Input size="large" prefix={<UserOutlined />} />
                  </Form.Item>
                  {role === "teacher" && (
                    <Form.Item name="honorific" label="称呼">
                      <Input size="large" placeholder="例如：李老师、王静怡老师" />
                    </Form.Item>
                  )}
                  <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />} loading={savingProfile}>保存个人信息</Button>
                </Form>
              </Card>
            ),
          },
          {
            key: "password",
            label: "修改密码",
            children: (
              <Card className="settings-card">
                <Form form={passwordForm} layout="vertical" onFinish={(values) => void changePassword(values)}>
                  <Form.Item name="password" label="新密码" rules={[{ required: true, min: 8, message: "新密码至少 8 位" }]}>
                    <Input.Password size="large" prefix={<LockOutlined />} />
                  </Form.Item>
                  <Form.Item name="confirm" label="确认新密码" rules={[{ required: true, message: "请再次输入新密码" }]}>
                    <Input.Password size="large" prefix={<LockOutlined />} />
                  </Form.Item>
                  <Button type="primary" size="large" htmlType="submit" icon={<LockOutlined />} loading={changingPassword}>更新密码</Button>
                </Form>
              </Card>
            ),
          },
          ...(role === "teacher" ? [{
            key: "student-password",
            label: "学生密码重置",
            children: (
              <Card className="settings-card">
                <p className="settings-help">学生忘记密码时，选择学生并生成一个一次性新密码。新密码只显示这一次，请及时发给学生。</p>
                <Form form={studentForm} layout="vertical" onFinish={(values) => void resetStudentPassword(values)}>
                  <Form.Item name="studentId" label="选择学生" rules={[{ required: true, message: "请选择学生" }]}>
                    <Select
                      showSearch
                      size="large"
                      placeholder="按姓名、学号或班级搜索"
                      optionFilterProp="label"
                      options={students.map((student) => ({
                        value: student.id,
                        label: `${student.name} · ${student.studentNo} · ${student.className}`,
                      }))}
                    />
                  </Form.Item>
                  <Button type="primary" size="large" htmlType="submit" icon={<ReloadOutlined />} loading={resettingPassword}>重置学生密码</Button>
                </Form>
              </Card>
            ),
          }] : []),
        ]}
      />

      <Modal
        title="学生新密码只显示这一次"
        open={Boolean(credential)}
        onCancel={() => setCredential(null)}
        footer={<Button type="primary" onClick={() => setCredential(null)}>我已保存</Button>}
      >
        {credential && (
          <Space direction="vertical" size={12}>
            <Tag color="green">学号：{credential.studentNo}</Tag>
            <Tag color="blue">姓名：{credential.name}</Tag>
            <div className="settings-password-box">{credential.password}</div>
          </Space>
        )}
      </Modal>
    </>
  );
}
