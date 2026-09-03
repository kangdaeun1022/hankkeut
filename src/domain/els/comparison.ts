import type {
  Outcome,
  PredictedOutcome,
  PredictionComparison,
} from "./types";

export const OUTCOMES = ["PROFIT", "PRINCIPAL", "LOSS"] as const;
export const PREDICTED_OUTCOMES = [...OUTCOMES, "UNSURE"] as const;

export const isOutcome = (value: unknown): value is Outcome =>
  typeof value === "string" &&
  (OUTCOMES as readonly string[]).includes(value);

export const isPredictedOutcome = (
  value: unknown,
): value is PredictedOutcome =>
  typeof value === "string" &&
  (PREDICTED_OUTCOMES as readonly string[]).includes(value);

export const comparePrediction = (
  prediction: PredictedOutcome,
  actualOutcome: Outcome,
): PredictionComparison => {
  if (!isPredictedOutcome(prediction)) {
    throw new TypeError(`지원하지 않는 예상 결과입니다: ${String(prediction)}`);
  }
  if (!isOutcome(actualOutcome)) {
    throw new TypeError(`지원하지 않는 실제 결과입니다: ${String(actualOutcome)}`);
  }

  if (prediction === "UNSURE") {
    return {
      prediction,
      actualOutcome,
      status: "UNSURE",
      isMatch: null,
    };
  }

  const isMatch = prediction === actualOutcome;
  return {
    prediction,
    actualOutcome,
    status: isMatch ? "MATCH" : "MISMATCH",
    isMatch,
  };
};
