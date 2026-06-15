import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { parseRoster } from "@/lib/qwen";
import { recordAiJob, safeErrorMessage } from "@/lib/ai-job-log";
export async function POST(request:Request){const startedAt=Date.now();try{await requireApiRole(["teacher"]);const {fileUrl}=z.object({fileUrl:z.string().refine((value)=>value.startsWith("data:image/")||URL.canParse(value),"必须提供有效名单图片")}).parse(await request.json());const result=await parseRoster(fileUrl);await recordAiJob({type:"roster_parse",status:"completed",model:process.env.QWEN_VISION_MODEL??"qwen3-vl-plus",durationMs:Date.now()-startedAt,itemCount:result.length});return NextResponse.json(result);}catch(error){await recordAiJob({type:"roster_parse",status:"failed",model:process.env.QWEN_VISION_MODEL??"qwen3-vl-plus",durationMs:Date.now()-startedAt,itemCount:1,error:safeErrorMessage(error)});return authErrorResponse(error);}}
