import { NextResponse } from "next/server";
import { z } from "zod";
import { createReviewBatch } from "@/lib/qwen";
import { recordAiJob, safeErrorMessage } from "@/lib/ai-job-log";

const schema=z.object({jobs:z.array(z.object({customId:z.string(),imageUrl:z.string().url(),rubric:z.unknown()})).min(1).max(500)});
export async function POST(request:Request){const startedAt=Date.now();let itemCount=1;try{const {jobs}=schema.parse(await request.json());itemCount=jobs.length;const result=await createReviewBatch(jobs);await recordAiJob({type:"batch_review",status:"completed",model:process.env.QWEN_VISION_MODEL??"qwen3-vl-plus",durationMs:Date.now()-startedAt,itemCount});return NextResponse.json(result);}catch(error){await recordAiJob({type:"batch_review",status:"failed",model:process.env.QWEN_VISION_MODEL??"qwen3-vl-plus",durationMs:Date.now()-startedAt,itemCount,error:safeErrorMessage(error)});return NextResponse.json({error:safeErrorMessage(error)},{status:400});}}
