import type { UnderstandingAnalysis } from "./schema";

const averageSignals = [
  /평균/iu,
  /다른\s*(두|둘|2)\s*(개|지수|개가)?[^.!?]*(괜찮|좋|버티|만회)/iu,
  /나머지\s*(두|둘|2)[^.!?]*(괜찮|좋|버티|만회)/iu,
  /전체적(으로|인)/iu,
  /하나[^.!?]*(떨어|하락)[^.!?]*(괜찮|상관없|되는)/iu,
];

const worstOfSignals = [
  /(가장|제일)\s*(낮|못한)/iu,
  /최저/iu,
  /워스트[\s-]?오프/iu,
  /worst[\s-]?of/iu,
  /하나라도[^.!?]*(낮|떨어|하락)/iu,
];

function hasSignal(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * API 키가 없는 심사용 환경에서도 고정 샘플의 흐름을 확인할 수 있게 하는
 * 제한적인 안전 데모 분석입니다. 금융 계산은 수행하지 않습니다.
 */
export function analyzeWithSafeDemo(text: string): UnderstandingAnalysis {
  const seesAverage = hasSignal(text, averageSignals);
  const seesWorstOf = hasSignal(text, worstOfSignals);

  if (seesAverage && !seesWorstOf) {
    return {
      ruleId: "R02_REFERENCE_ASSET",
      understanding: "AVERAGE",
      evidence: text,
      summary:
        "세 기초자산의 평균을 기준으로 결과를 판단하고, 한 지수가 크게 떨어져도 나머지 두 지수가 높으면 괜찮다고 이해했습니다.",
      status: "SUPPORTED",
    };
  }

  if (seesWorstOf && !seesAverage) {
    return {
      ruleId: "R02_REFERENCE_ASSET",
      understanding: "WORST_OF",
      evidence: text,
      summary:
        "세 기초자산 중 가장 낮은 기초자산이 결과를 결정한다고 이해했습니다.",
      status: "SUPPORTED",
    };
  }

  return {
    ruleId: seesAverage && seesWorstOf ? "R02_REFERENCE_ASSET" : "UNRESOLVED",
    understanding: "UNCLEAR",
    evidence: seesAverage && seesWorstOf ? text : "",
    summary:
      "입력한 내용만으로는 평균과 Worst-of 중 어떤 기준으로 이해했는지 명확히 판단하기 어렵습니다.",
    status: seesAverage && seesWorstOf ? "AMBIGUOUS" : "ABSTAINED",
  };
}

export function hasValidEvidence(
  sourceText: string,
  analysis: UnderstandingAnalysis,
) {
  if (analysis.status === "ABSTAINED") {
    return analysis.evidence === "";
  }

  return analysis.evidence.length > 0 && sourceText.includes(analysis.evidence);
}
