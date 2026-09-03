import { VIRTUAL_STEP_DOWN_ELS_PRODUCT } from "./product";
import {
  calculateAverageLevelBp,
  createElsScenario,
  formatBasisPoints,
  formatSignedBasisPoints,
} from "./scenario";
import {
  PRINCIPAL_BASIS_POINTS,
  type BasisPoints,
  type ElsScenario,
  type ElsScenarioInput,
  type MaturityEvaluation,
  type Outcome,
  type StepDownElsProduct,
} from "./types";

export const classifyRedemptionOutcome = (
  redemptionBp: BasisPoints,
): Outcome => {
  if (!Number.isInteger(redemptionBp) || redemptionBp < 0) {
    throw new RangeError("Redemption basis points must be a non-negative integer.");
  }
  if (redemptionBp > PRINCIPAL_BASIS_POINTS) return "PROFIT";
  if (redemptionBp === PRINCIPAL_BASIS_POINTS) return "PRINCIPAL";
  return "LOSS";
};

/**
 * Deterministic maturity calculation. No generative-AI output is used here.
 * The average is returned solely for the comparison UI; only Worst-of decides
 * whether the barrier is met.
 */
export const evaluateMaturity = (
  scenarioInput: ElsScenario | ElsScenarioInput,
  product: StepDownElsProduct = VIRTUAL_STEP_DOWN_ELS_PRODUCT,
): MaturityEvaluation => {
  const scenario = createElsScenario(scenarioInput);
  const levelByAsset = new Map(
    scenario.levels.map((level) => [level.assetId, level] as const),
  );
  const orderedLevels = product.assets.map((asset) => {
    const level = levelByAsset.get(asset.id);
    if (!level) {
      throw new Error(`Validated scenario is missing asset: ${asset.id}`);
    }
    return level;
  });

  const worstLevelBp = Math.min(...orderedLevels.map((level) => level.levelBp));
  const worstAssetIds = orderedLevels
    .filter((level) => level.levelBp === worstLevelBp)
    .map((level) => level.assetId);
  const averageLevelBp = calculateAverageLevelBp(orderedLevels);
  const barrierMet = worstLevelBp >= product.maturity.barrierBp;
  const redemptionBp = barrierMet
    ? product.maturity.successRedemptionBp
    : worstLevelBp;
  const returnRateBp = redemptionBp - PRINCIPAL_BASIS_POINTS;

  return {
    productId: product.id,
    scenarioId: scenario.id,
    observationMethod: "WORST_OF",
    levels: orderedLevels,
    worstLevelBp,
    worstLevelDisplay: formatBasisPoints(worstLevelBp),
    worstAssetIds,
    averageLevelBp,
    averageLevelDisplay: formatBasisPoints(averageLevelBp),
    averageUsedForOutcome: false,
    barrierBp: product.maturity.barrierBp,
    barrierMet,
    redemptionBp,
    redemptionDisplay: formatBasisPoints(redemptionBp),
    returnRateBp,
    returnRateDisplay: formatSignedBasisPoints(returnRateBp),
    outcome: classifyRedemptionOutcome(redemptionBp),
  };
};

export const evaluateVirtualElsMaturity = (
  scenario: ElsScenario | ElsScenarioInput,
): MaturityEvaluation =>
  evaluateMaturity(scenario, VIRTUAL_STEP_DOWN_ELS_PRODUCT);
