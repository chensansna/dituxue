import OpenAI from "openai";
import { reviewResultSchema, rosterSchema } from "./domain";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_QWEN_VISION_MODEL = "qwen3-vl-plus";

function qwenBaseUrl() {
  const value = process.env.QWEN_BASE_URL?.trim();
  if (!value || value.includes("api.example.com")) return DEFAULT_QWEN_BASE_URL;
  return value.replace(/\/+$/, "");
}

export function qwenVisionModel() {
  return process.env.QWEN_VISION_MODEL?.trim() || DEFAULT_QWEN_VISION_MODEL;
}

function client() {
  if (!process.env.QWEN_API_KEY) throw new Error("QWEN_API_KEY 未配置");
  return new OpenAI({ apiKey: process.env.QWEN_API_KEY, baseURL: qwenBaseUrl(), maxRetries: 3 });
}

function batchClient() {
  if (!process.env.QWEN_API_KEY) throw new Error("QWEN_API_KEY 未配置");
  return new OpenAI({ apiKey: process.env.QWEN_API_KEY, baseURL: process.env.QWEN_BATCH_BASE_URL?.trim() || "https://batch.dashscope.aliyuncs.com/compatible-mode/v1", maxRetries: 3 });
}

export async function checkQwenConnection() {
  const response = await client().chat.completions.create({
    model: qwenVisionModel(),
    temperature: 0,
    max_tokens: 8,
    messages: [{ role: "user", content: "只回复：连接成功" }],
  });
  return {
    ok: true,
    model: response.model,
    message: response.choices[0]?.message.content ?? "",
  };
}

export async function createReviewBatch(jobs: Array<{ customId: string; imageUrl: string; rubric: unknown }>) {
  const api = batchClient();
  const jsonl = jobs.map((job) => JSON.stringify({
    custom_id: job.customId,
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: qwenVisionModel(),
      temperature: 0.1,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: job.imageUrl } },
        { type: "text", text: `按地图学量表审查并返回纯 JSON：${JSON.stringify(job.rubric)}` },
      ] }],
    },
  })).join("\n");
  const input = await api.files.create({ file: new File([jsonl], "map-review-batch.jsonl", { type: "application/jsonl" }), purpose: "batch" });
  return api.batches.create({ input_file_id: input.id, endpoint: "/v1/chat/completions", completion_window: "24h" });
}

function jsonFromText(text: string) {
  const clean = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(clean);
}

export async function reviewMap(
  imageUrl: string,
  rubric: Array<{ id: string; title: string }>,
  assignment?: { title?: string | null; description?: string | null },
) {
  const assignmentTitle = assignment?.title?.trim() || "地图作业";
  const assignmentDescription = assignment?.description?.trim() || "教师未填写详细任务说明，请根据作业标题和地图画面进行谨慎评价。";
  const response = await client().chat.completions.create({
    model: qwenVisionModel(),
    temperature: 0.1,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: imageUrl } },
      { type: "text", text: `你是地图学课程的 AI 辅助评分助手。请同时完成两件事：

一、形式要素检查，只判断学生地图画布中是否存在指定要素，不计入成绩。
检查项：${JSON.stringify(rubric)}
判定规则：
1. 忽略软件界面、按钮、审查表、旧状态和旧评语。
2. 指北针：地图画布中出现明确指北符号或北向标记才为 true。
3. 比例尺：出现数字比例尺、文字比例尺或图解比例尺才为 true；经纬网和坐标标注不能代替比例尺。
4. 图例：出现明确图例区域，并说明至少一个地图符号或颜色才为 true。
5. 坐标格网：地图画布中出现格网线、经纬网线或坐标刻度标注才为 true。
6. 没有清晰看到就判定 false。evidence 只描述可见依据。

二、根据教师作业要求给出 AI 评分建议。该分数只是教师参考，不是最终成绩。
作业标题：${assignmentTitle}
作业要求：${assignmentDescription}
评分关注：主题是否符合要求、必要地图内容是否完整、边界/图层表达是否符合任务、图面层次和符号是否清晰、制图规范是否合理。不要因为缺少形式要素直接扣满分，但可以在问题中指出。

返回纯 JSON，不要 markdown。结构必须为：
{
  "summary":"形式要素和评分建议的简短总结",
  "confidence":0.9,
  "items":[{"rubricId":"必须与检查项 id 一致","present":true,"evidence":"可见依据"}],
  "aiAssessment":{
    "suggestedScore":82,
    "scoreRange":{"min":78,"max":86},
    "requirementMatch":0.82,
    "strengths":["优点1","优点2"],
    "issues":["问题1","问题2"],
    "suggestions":["修改建议1","修改建议2"],
    "dimensions":[
      {"name":"主题符合度","score":85,"comment":"说明"},
      {"name":"内容完整性","score":80,"comment":"说明"},
      {"name":"图面表达","score":82,"comment":"说明"},
      {"name":"制图规范","score":78,"comment":"说明"}
    ]
  }
}` },
    ] }],
  });
  return reviewResultSchema.parse(jsonFromText(response.choices[0]?.message.content ?? ""));
}

export async function parseRoster(fileUrl: string) {
  const response = await client().chat.completions.create({
    model: qwenVisionModel(),
    temperature: 0,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: fileUrl } },
      { type: "text", text: '识别学生名单并返回纯 JSON 数组。每项结构：{"studentNo":"","name":"","className":"","confidence":0.9,"issue":""}' },
    ] }],
  });
  return rosterSchema.parse(jsonFromText(response.choices[0]?.message.content ?? ""));
}
