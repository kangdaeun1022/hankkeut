import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { analyzeWithSafeDemo, hasValidEvidence } from "./fallback";
import { ANALYSIS_INSTRUCTIONS, buildAnalysisInput } from "./prompt";
import {
  understandingAnalysisSchema,
  type AnalyzeResponse,
  type UnderstandingAnalysis,
} from "./schema";

const DEFAULT_MODEL = "gpt-5.4-mini";

function safeDemoResponse(text: string, notice: string): AnalyzeResponse {
  return {
    analysis: analyzeWithSafeDemo(text),
    meta: {
      mode: "demo",
      notice,
    },
  };
}

export async function analyzeUnderstanding(
  text: string,
): Promise<AnalyzeResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return safeDemoResponse(
      text,
      "API 키가 없어 제한된 안전 데모 분석을 사용했습니다.",
    );
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.parse(
      {
        model,
        store: false,
        instructions: ANALYSIS_INSTRUCTIONS,
        input: buildAnalysisInput(text),
        text: {
          format: zodTextFormat(
            understandingAnalysisSchema,
            "contract_understanding",
          ),
        },
      },
      { signal: AbortSignal.timeout(10_000) },
    );

    const parsed = response.output_parsed as UnderstandingAnalysis | null;

    if (!parsed || !hasValidEvidence(text, parsed)) {
      return safeDemoResponse(
        text,
        "AI 근거를 원문에서 확인할 수 없어 안전 데모 분석으로 전환했습니다.",
      );
    }

    return {
      analysis: parsed,
      meta: {
        mode: "live",
        model,
      },
    };
  } catch {
    return safeDemoResponse(
      text,
      "AI 연결이 원활하지 않아 안전 데모 분석으로 전환했습니다.",
    );
  }
}
