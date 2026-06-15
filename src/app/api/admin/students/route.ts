import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema=z.object({classId:z.string().uuid(),students:z.array(z.object({studentNo:z.string().min(1),name:z.string().min(1)})).min(1).max(200)});
function initialPassword(){return `Map@${randomBytes(6).toString("base64url")}`;}

export async function POST(request:Request){
  try{
    const session=await createSupabaseServerClient();
    const {data:{user}}=await session.auth.getUser();
    if(!user)return NextResponse.json({error:"未登录"},{status:401});
    const {data:profile}=await session.from("profiles").select("role").eq("id",user.id).single();
    if(!profile||!["teacher","admin"].includes(profile.role))return NextResponse.json({error:"无权限"},{status:403});
    const {classId,students}=schema.parse(await request.json());
    const admin=createSupabaseAdminClient();
    const credentials:Array<{studentNo:string;name:string;password:string;status:string}>=[];
    for(const student of students){
      const password=initialPassword();
      const email=`${student.studentNo}@students.local`;
      const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:student.name,student_no:student.studentNo}});
      if(error||!data.user){credentials.push({...student,password:"",status:error?.message??"创建失败"});continue;}
      await admin.from("profiles").insert({id:data.user.id,role:"student",student_no:student.studentNo,display_name:student.name,must_change_password:true});
      await admin.from("class_members").insert({class_id:classId,student_id:data.user.id});
      credentials.push({...student,password,status:"已创建"});
    }
    return NextResponse.json({credentials});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"创建账号失败"},{status:400});}
}
