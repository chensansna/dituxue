import { z } from "zod";

export const submissionStatuses = ["ai_processing", "ai_failed", "pending_teacher_review", "returned", "reviewed", "graded"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const reviewResultSchema = z.object({
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  items: z.array(z.object({
    rubricId: z.string(),
    present: z.boolean(),
    evidence: z.string(),
  })),
  aiAssessment: z.object({
    suggestedScore: z.number().min(0).max(100),
    scoreRange: z.object({
      min: z.number().min(0).max(100),
      max: z.number().min(0).max(100),
    }),
    requirementMatch: z.number().min(0).max(1),
    strengths: z.array(z.string()),
    issues: z.array(z.string()),
    suggestions: z.array(z.string()),
    dimensions: z.array(z.object({
      name: z.string(),
      score: z.number().min(0).max(100),
      comment: z.string(),
    })),
  }).optional(),
});

export const rosterSchema = z.array(z.object({
  studentNo: z.string().min(1),
  name: z.string().min(1),
  className: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1),
  issue: z.string().optional(),
}));

export function rubricScore(items: Array<{ score: number; weight: number }>) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.001) throw new Error("量表权重总和必须为 100%");
  return Math.round(items.reduce((sum, item) => sum + item.score * item.weight / 100, 0) * 10) / 10;
}

export function canStudentSubmit(deadline: Date, extension?: Date, now = new Date()) {
  return now <= (extension ?? deadline);
}
