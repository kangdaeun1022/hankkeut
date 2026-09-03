import { describe, expect, it } from "vitest";
import {
  analyzeWithSafeDemo,
  hasValidEvidence,
} from "@/server/ai/fallback";

describe("safe demo understanding analysis", () => {
  it("maps the canonical sample to the average misunderstanding", () => {
    const text =
      "세 지수는 평균적으로 보는 걸로 이해했어요. 하나가 많이 떨어져도 다른 두 지수가 괜찮으면 되는 거 아닌가요?";
    const result = analyzeWithSafeDemo(text);

    expect(result).toMatchObject({
      ruleId: "R02_REFERENCE_ASSET",
      understanding: "AVERAGE",
      status: "SUPPORTED",
      evidence: text,
    });
  });

  it("recognizes a clear Worst-of understanding", () => {
    const text = "세 지수 중 가장 낮은 지수 하나가 결과를 정하는 거죠?";
    const result = analyzeWithSafeDemo(text);

    expect(result.understanding).toBe("WORST_OF");
    expect(result.status).toBe("SUPPORTED");
  });

  it("abstains when no supported contract understanding is present", () => {
    const result = analyzeWithSafeDemo("수익률이 높을 것 같아서 관심이 있어요.");

    expect(result).toMatchObject({
      ruleId: "UNRESOLVED",
      understanding: "UNCLEAR",
      status: "ABSTAINED",
      evidence: "",
    });
  });

  it("rejects evidence that is not an exact source substring", () => {
    const text = "세 지수의 평균을 보는 줄 알았어요.";
    const result = analyzeWithSafeDemo(text);

    expect(hasValidEvidence(text, result)).toBe(true);
    expect(
      hasValidEvidence(text, {
        ...result,
        evidence: "원문에 없는 문장",
      }),
    ).toBe(false);
  });
});
