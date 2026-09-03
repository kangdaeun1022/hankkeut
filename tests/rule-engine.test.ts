import { describe, expect, it } from "vitest";

import { comparePrediction } from "../src/domain/els/comparison";
import { VIRTUAL_STEP_DOWN_ELS_PRODUCT } from "../src/domain/els/product";
import {
  ElsScenarioValidationError,
  VIRTUAL_ELS_SCENARIO,
  calculateAverageLevelBp,
  createElsScenario,
  formatBasisPoints,
  validateElsScenario,
} from "../src/domain/els/scenario";
import {
  classifyRedemptionOutcome,
  evaluateVirtualElsMaturity,
} from "../src/domain/els/rule-engine";

describe("virtual Step-down ELS product", () => {
  it("uses the fixed MVP maturity terms", () => {
    expect(VIRTUAL_STEP_DOWN_ELS_PRODUCT.id).toBe("virtual-stepdown-els-001");
    expect(VIRTUAL_STEP_DOWN_ELS_PRODUCT.maturity).toEqual({
      observationMethod: "WORST_OF",
      barrierBp: 8_000,
      successRedemptionBp: 10_800,
      failureRedemptionMethod: "WORST_LEVEL",
    });
  });
});

describe("scenario validation", () => {
  it("accepts exactly the three required assets in integer bp", () => {
    expect(validateElsScenario(VIRTUAL_ELS_SCENARIO)).toEqual({
      valid: true,
      scenario: VIRTUAL_ELS_SCENARIO,
    });
  });

  it("reports duplicate and missing assets together", () => {
    const result = validateElsScenario({
      levels: [
        { assetId: "KOSPI200", levelBp: 9_400 },
        { assetId: "SP500", levelBp: 9_300 },
        { assetId: "SP500", levelBp: 6_100 },
      ],
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_ASSET",
          assetId: "SP500",
        }),
        expect.objectContaining({
          code: "MISSING_ASSET",
          assetId: "EUROSTOXX50",
        }),
      ]),
    );
  });

  it("rejects a missing asset and the wrong asset count", () => {
    const result = validateElsScenario({
      levels: [
        { assetId: "KOSPI200", levelBp: 9_400 },
        { assetId: "SP500", levelBp: 9_300 },
      ],
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["INVALID_ASSET_COUNT", "MISSING_ASSET"]),
    );
  });

  it.each([-1, 20_001, 9_400.5, Number.NaN])(
    "rejects an out-of-domain level: %s",
    (levelBp) => {
      expect(() =>
        createElsScenario({
          levels: [
            { assetId: "KOSPI200", levelBp },
            { assetId: "SP500", levelBp: 9_300 },
            { assetId: "EUROSTOXX50", levelBp: 6_100 },
          ],
        }),
      ).toThrow(ElsScenarioValidationError);
    },
  );

  it("rejects an unknown asset", () => {
    const result = validateElsScenario({
      levels: [
        { assetId: "KOSPI200", levelBp: 9_400 },
        { assetId: "SP500", levelBp: 9_300 },
        { assetId: "NASDAQ100", levelBp: 6_100 },
      ],
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_ASSET", assetId: "NASDAQ100" }),
        expect.objectContaining({
          code: "MISSING_ASSET",
          assetId: "EUROSTOXX50",
        }),
      ]),
    );
  });
});

describe("deterministic Worst-of maturity rule", () => {
  it("uses EuroStoxx50 at 61% instead of the 82.67% average", () => {
    const result = evaluateVirtualElsMaturity(VIRTUAL_ELS_SCENARIO);

    expect(result.levels.map((level) => level.levelBp)).toEqual([
      9_400, 9_300, 6_100,
    ]);
    expect(result.worstLevelBp).toBe(6_100);
    expect(result.worstAssetIds).toEqual(["EUROSTOXX50"]);
    expect(result.averageLevelBp).toBe(8_267);
    expect(result.averageLevelDisplay).toBe("82.67%");
    expect(result.averageUsedForOutcome).toBe(false);
    expect(result.barrierMet).toBe(false);
    expect(result.redemptionBp).toBe(6_100);
    expect(result.returnRateBp).toBe(-3_900);
    expect(result.returnRateDisplay).toBe("-39%");
    expect(result.outcome).toBe("LOSS");
  });

  it("treats the barrier as inclusive and returns 108% on success", () => {
    const scenario = createElsScenario({
      levels: [
        { assetId: "KOSPI200", levelBp: 8_000 },
        { assetId: "SP500", levelBp: 9_000 },
        { assetId: "EUROSTOXX50", levelBp: 10_000 },
      ],
    });

    const result = evaluateVirtualElsMaturity(scenario);
    expect(result.barrierMet).toBe(true);
    expect(result.redemptionBp).toBe(10_800);
    expect(result.redemptionDisplay).toBe("108%");
    expect(result.returnRateBp).toBe(800);
    expect(result.returnRateDisplay).toBe("+8%");
    expect(result.outcome).toBe("PROFIT");
  });

  it("returns every worst asset when levels are tied", () => {
    const scenario = createElsScenario({
      levels: [
        { assetId: "EUROSTOXX50", levelBp: 7_500 },
        { assetId: "KOSPI200", levelBp: 7_500 },
        { assetId: "SP500", levelBp: 9_000 },
      ],
    });

    expect(evaluateVirtualElsMaturity(scenario).worstAssetIds).toEqual([
      "KOSPI200",
      "EUROSTOXX50",
    ]);
  });

  it("classifies profit, principal, and loss from redemption bp", () => {
    expect(classifyRedemptionOutcome(10_001)).toBe("PROFIT");
    expect(classifyRedemptionOutcome(10_000)).toBe("PRINCIPAL");
    expect(classifyRedemptionOutcome(9_999)).toBe("LOSS");
  });

  it("keeps all level and average calculations in integer bp", () => {
    expect(calculateAverageLevelBp(VIRTUAL_ELS_SCENARIO.levels)).toBe(8_267);
    expect(formatBasisPoints(9_400)).toBe("94%");
    expect(formatBasisPoints(8_267)).toBe("82.67%");
  });
});

describe("prediction comparison", () => {
  it("marks matching and mismatching predictions", () => {
    expect(comparePrediction("LOSS", "LOSS")).toEqual({
      prediction: "LOSS",
      actualOutcome: "LOSS",
      status: "MATCH",
      isMatch: true,
    });
    expect(comparePrediction("PROFIT", "LOSS")).toEqual({
      prediction: "PROFIT",
      actualOutcome: "LOSS",
      status: "MISMATCH",
      isMatch: false,
    });
  });

  it("preserves an unsure prediction without forcing true or false", () => {
    expect(comparePrediction("UNSURE", "LOSS")).toEqual({
      prediction: "UNSURE",
      actualOutcome: "LOSS",
      status: "UNSURE",
      isMatch: null,
    });
  });
});
