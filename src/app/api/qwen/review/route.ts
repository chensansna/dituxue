import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewMap } from "@/lib/qwen";
import { recordAiJob, safeErrorMessage } from "@/lib/ai-job-log";

const bodySchema=z.object({imageUrl:z.string().refine((value)=>value.startsWith("data:image/")||URL.canParse(value),"必须提供有效图片地址或图片数据"),rubric:z.array(z.object({id:z.string(),title:z.string()}))});
export async function POST(request:Request){
  const startedAt=Date.now();
  try { const body=bodySchema.parse(await request.json()); const result=await reviewMap(body.imageUrl,body.rubric); await recordAiJob({type:"map_review",status:"completed",model:process.env.QWEN_VISION_MODEL??"qwen3-vl-plus",durationMs:Date.now()-startedAt,itemCount:1}); return NextResponse.json(result); }
  catch(error){ await recordAiJob({type:"map_review",status:"failed",model:process.env.QWEN_VISION_MODEL??"qwen3-vl-plus",durationMs:Date.now()-startedAt,itemCount:1,error:safeErrorMessage(error)}); return NextResponse.json({error:safeErrorMessage(error)},{status:400}); }
}
