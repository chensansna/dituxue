import { describe, expect, it } from "vitest";
import { canStudentSubmit, rubricScore, reviewResultSchema } from "./domain";

describe("domain rules",()=>{
  it("calculates a weighted rubric score",()=>expect(rubricScore([{score:90,weight:60},{score:80,weight:40}])).toBe(86));
  it("rejects invalid rubric weights",()=>expect(()=>rubricScore([{score:90,weight:50}])).toThrow());
  it("allows an active personal extension",()=>expect(canStudentSubmit(new Date("2026-06-10"),new Date("2026-06-20"),new Date("2026-06-15"))).toBe(true));
  it("validates structured review results",()=>expect(reviewResultSchema.safeParse({summary:"形式要素检查完成",confidence:.9,items:[]}).success).toBe(true));
  it("validates AI grading suggestions without mixing them into formal checks",()=>expect(reviewResultSchema.safeParse({
    summary:"形式要素检查完成，并给出评分建议",
    confidence:.9,
    items:[{rubricId:"north_arrow",present:true,evidence:"右上角可见指北针"}],
    aiAssessment:{
      suggestedScore:86,
      scoreRange:{min:82,max:90},
      requirementMatch:.86,
      strengths:["主题表达清楚"],
      issues:["局部边界层次不足"],
      suggestions:["增强省界与市界区分"],
      dimensions:[{name:"主题符合度",score:88,comment:"基本符合江苏边界图要求"}],
    },
  }).success).toBe(true));
});
