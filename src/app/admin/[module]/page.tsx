import { AppShell } from "@/components/app-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
const names:Record<string,[string,string]>={users:["教师账号","创建、停用和审计教师账号。"],"ai-jobs":["AI 调用记录","查看 Qwen 模型调用状态、耗时和脱敏错误。"],settings:["系统设置","查看服务配置与文件限制，密钥通过环境变量管理。"]};
export default async function Page({params}:{params:Promise<{module:string}>}){const {module}=await params;const [title,desc]=names[module]??["管理模块","维护系统运行配置。"];return <AppShell role="admin" title={title} subtitle="管理员工作台"><ModulePlaceholder title={title} description={desc} role="管理员" /></AppShell>}
