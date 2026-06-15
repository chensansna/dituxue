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

export async function reviewMap(imageUrl: string, rubric: Array<{ id: string; title: string }>) {
  const response = await client().chat.completions.create({
    model: qwenVisionModel(),
    temperature: 0.1,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: imageUrl } },
      { type: "text", text: `你是地图学形式要素检测助手。只检查学生地图画布中是否存在指定要素，不评分，不评价美观，不提出修改建议。
必须逐项检查：${JSON.stringify(rubric)}。
判定规则：
1. 忽略软件界面、按钮、审查表、旧状态和旧评语。
2. 指北针：地图画布中出现明确指北符号或北向标记才为 true。
3. 比例尺：出现数字比例尺、文字比例尺或图解比例尺才为 true；经纬网和坐标标注不能代替比例尺。
4. 图例：出现明确图例区域，并说明至少一个地图符号或颜色才为 true。
5. 坐标格网：地图画布中出现格网线、经纬网线或坐标刻度标注才为 true。
6. 没有清晰看到就判定 false。evidence 只描述可见依据。
返回纯 JSON，不要 markdown。结构：{"summary":"形式要素检查总结","confidence":0.9,"items":[{"rubricId":"必须与检查项 id 一致","present":true,"evidence":"可见依据"}]}` },
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
