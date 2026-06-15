import { describe, expect, it } from "vitest";
import { canStudentSubmit, rubricScore, reviewResultSchema } from "./domain";

describe("domain rules",()=>{
  it("calculates a weighted rubric score",()=>expect(rubricScore([{score:90,weight:60},{score:80,weight:40}])).toBe(86));
  it("rejects invalid rubric weights",()=>expect(()=>rubricScore([{score:90,weight:50}])).toThrow());
  it("allows an active personal extension",()=>expect(canStudentSubmit(new Date("2026-06-10"),new Date("2026-06-20"),new Date("2026-06-15"))).toBe(true));
  it("validates structured review results",()=>expect(reviewResultSchema.safeParse({summary:"形式要素检查完成",confidence:.9,items:[]}).success).toBe(true));
});
