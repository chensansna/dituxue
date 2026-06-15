import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
export default function Page(){return <AppShell role="admin" title="系统运行概览" subtitle="服务状态与账号管理"><AdminDashboard /></AppShell>}
