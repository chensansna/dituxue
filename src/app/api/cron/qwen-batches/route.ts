import { NextResponse } from "next/server";
export async function GET(request:Request){if(process.env.CRON_SECRET&&request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({ok:true,message:"批量任务同步入口已就绪",checkedAt:new Date().toISOString()});}
