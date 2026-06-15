# 基于 LLM 的地图学教学辅助系统

面向管理员、教师和学生的地图学作业管理与 AI 形式审查系统。前端采用 Next.js 16、TypeScript 和 Ant Design，部署目标为 Vercel；数据、认证和私有文件存储使用 Supabase；地图审查和名单识别使用线上 Qwen 多模态 API。

## 本地运行

最简单的方式：双击项目根目录中的 `启动系统.cmd`，脚本会自动启动服务并打开浏览器。

1. 复制 `.env.example` 为 `.env.local` 并填写 Supabase、Qwen 和 Cron 配置。
2. 在 Supabase SQL Editor 执行 `supabase/migrations/001_initial_schema.sql`。
3. 运行 `npm install`，然后运行 `npm run dev`。
4. 未配置外部服务时，根页面仍可进入三类角色的高保真演示工作台。

## 关键路由

- `/`：角色登录与演示入口
- `/teacher`、`/teacher/review`：教师概览和地图复评工作区
- `/student`：移动优先的学生作业页
- `/admin`：管理员运行概览
- `/api/qwen/review`、`/api/qwen/roster`：服务端 Qwen 调用
- `/api/qwen/batches`：提交 Qwen 批量审查任务
- `/api/admin/students`：教师确认名单后批量创建学生账号与一次性初始密码
- `/api/cron/qwen-batches`：Vercel Cron 批量任务同步入口

## 安全与部署

- Qwen API Key 与 Supabase Service Role Key 只能配置为 Vercel 服务端环境变量。
- 地图文件桶为私有桶，生产调用应由服务端生成短期签名 URL。
- 数据库使用 RLS 隔离学生、教师与管理员数据。
- 删除业务数据应使用 `deleted_at` 软删除，不批量删除文件或目录。
- `xlsx@0.18.5` 当前存在上游安全公告且 npm 无可用修复版；上线前应改用经过安全评估的表格解析服务或新版 SheetJS 官方发行渠道。
