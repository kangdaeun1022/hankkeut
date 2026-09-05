import { GoogleGenAI } from "@google/genai";
import { analyzeWithSafeDemo, hasValidEvidence } from "./fallback";
import { ANALYSIS_INSTRUCTIONS, buildAnalysisInput } from "./prompt";
import {
  understandingAnalysisSchema,
  type AnalyzeResponse,
} from "./schema";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

const geminiAnalysisSchema = {
  type: "object",
  properties: {
    ruleId: {
      type: "string",
      enum: ["R02_REFERENCE_ASSET", "UNRESOLVED"],
    },
    understanding: {
      type: "string",
      enum: ["AVERAGE", "WORST_OF", "UNCLEAR"],
    },
    evidence: { type: "string" },
    summary: { type: "string" },
    status: {
      type: "string",
      enum: ["SUPPORTED", "AMBIGUOUS", "ABSTAINED"],
    },
  },
  required: [
    "ruleId",
    "understanding",
    "evidence",
    "summary",
    "status",
  ],
  additionalProperties: false,
} as const;

function safeDemoResponse(text: string, notice: string): AnalyzeResponse {
  return {
    analysis: analyzeWithSafeDemo(text),
    meta: {
      mode: "demo",
      notice,
    },
  };
}

// ponytail: MVP 제출용, 라이브 호출 세션에서 재현되는 렌더 정지 버그 회피 위해 데모 고정.
// GEMINI_API_KEY는 그대로 연결해둠 — 이 줄만 지우면 라이브 분석 재활성화.
const FORCE_DEMO_MODE = true;

export async function analyzeUnderstanding(
  text: string,
): Promise<AnalyzeResponse> {
  const apiKey = FORCE_DEMO_MODE ? undefined : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return safeDemoResponse(
      text,
      "API 키가 없어 제한된 안전 데모 분석을 사용했습니다.",
    );
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: buildAnalysisInput(text),
      config: {
        systemInstruction: ANALYSIS_INSTRUCTIONS,
        responseMimeType: "application/json",
        responseJsonSchema: geminiAnalysisSchema,
        temperature: 0,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(10_000),
      },
    });

    if (!response.text) {
      return safeDemoResponse(
        text,
        "Gemini 응답이 비어 있어 안전 데모 분석으로 전환했습니다.",
      );
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(response.text);
    } catch {
      return safeDemoResponse(
        text,
        "Gemini 응답 형식을 확인할 수 없어 안전 데모 분석으로 전환했습니다.",
      );
    }

    const parsed = understandingAnalysisSchema.safeParse(candidate);

    if (!parsed.success) {
      return safeDemoResponse(
        text,
        "AI 근거를 원문에서 확인할 수 없어 안전 데모 분석으로 전환했습니다.",
      );
    }

    if (!hasValidEvidence(text, parsed.data)) {
      return safeDemoResponse(
        text,
        "AI 근거를 원문에서 확인할 수 없어 안전 데모 분석으로 전환했습니다.",
      );
    }

    return {
      analysis: parsed.data,
      meta: {
        mode: "live",
        model,
      },
    };
  } catch {
    return safeDemoResponse(
      text,
      "Gemini 연결이 원활하지 않아 안전 데모 분석으로 전환했습니다.",
    );
  }
}
