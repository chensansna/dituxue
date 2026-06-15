import { AppShell } from "@/components/app-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
const names:Record<string,[string,string]>={submissions:["提交记录","查看每次地图作业提交与历史版本。"],grades:["成绩与反馈","查看已发布的教师反馈与最终成绩。"]};
export default async function Page({params}:{params:Promise<{module:string}>}){const {module}=await params;const [title,desc]=names[module]??["学生模块","查看个人作业数据。"];return <AppShell role="student" title={title} subtitle="仅展示你的个人数据"><ModulePlaceholder title={title} description={desc} role="学生" /></AppShell>}
