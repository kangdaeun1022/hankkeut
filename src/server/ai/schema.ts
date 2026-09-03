import { z } from "zod";

export const analyzeRequestSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(8, "이해한 내용을 조금 더 자세히 입력해 주세요.")
      .max(500, "입력은 500자 이내로 작성해 주세요."),
  })
  .strict();

export const understandingAnalysisSchema = z
  .object({
    ruleId: z.enum(["R02_REFERENCE_ASSET", "UNRESOLVED"]),
    understanding: z.enum(["AVERAGE", "WORST_OF", "UNCLEAR"]),
    evidence: z.string().max(500),
    summary: z.string().max(300),
    status: z.enum(["SUPPORTED", "AMBIGUOUS", "ABSTAINED"]),
  })
  .strict();

export type UnderstandingAnalysis = z.infer<
  typeof understandingAnalysisSchema
>;

export type AnalysisMode = "live" | "demo";

export interface AnalyzeResponse {
  analysis: UnderstandingAnalysis;
  meta: {
    mode: AnalysisMode;
    model?: string;
    notice?: string;
  };
}
