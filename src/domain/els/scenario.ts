import { VIRTUAL_STEP_DOWN_ELS_PRODUCT } from "./product";
import {
  ELS_ASSET_IDS,
  MAX_LEVEL_BASIS_POINTS,
  MIN_LEVEL_BASIS_POINTS,
  type AssetLevel,
  type AssetLevelInput,
  type BasisPoints,
  type ElsAssetId,
  type ElsScenario,
  type ElsScenarioInput,
  type ScenarioValidationIssue,
  type ScenarioValidationResult,
} from "./types";

export const VIRTUAL_ELS_SCENARIO_ID = "virtual-market-scenario-001" as const;

const DEFAULT_SCENARIO_NAME = "세 지수 만기 평가 시나리오";

export class ElsScenarioValidationError extends Error {
  readonly issues: readonly ScenarioValidationIssue[];

  constructor(issues: readonly ScenarioValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "ElsScenarioValidationError";
    this.issues = issues;
  }
}

export const isElsAssetId = (value: string): value is ElsAssetId =>
  (ELS_ASSET_IDS as readonly string[]).includes(value);

export const isValidBasisPoints = (value: unknown): value is BasisPoints =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= MIN_LEVEL_BASIS_POINTS &&
  value <= MAX_LEVEL_BASIS_POINTS;

/**
 * Formats integer bp without locale-dependent output.
 * Examples: 9_400 -> "94%", 8_267 -> "82.67%".
 */
export const formatBasisPoints = (valueBp: BasisPoints): string => {
  if (!isValidBasisPoints(valueBp)) {
    throw new RangeError(
      `Basis points must be an integer from ${MIN_LEVEL_BASIS_POINTS} to ${MAX_LEVEL_BASIS_POINTS}.`,
    );
  }

  const percentage = (valueBp / 100).toFixed(2).replace(/\.0+$|(?<=\.[0-9])0$/, "");
  return `${percentage}%`;
};

/** Formats a signed integer-bp return, such as -3_900bp -> "-39%". */
export const formatSignedBasisPoints = (valueBp: number): string => {
  if (!Number.isInteger(valueBp)) {
    throw new TypeError("Return basis points must be an integer.");
  }

  const sign = valueBp > 0 ? "+" : "";
  const percentage = (valueBp / 100)
    .toFixed(2)
    .replace(/\.0+$|(?<=\.[0-9])0$/, "");
  return `${sign}${percentage}%`;
};

const validateLevels = (
  levels: readonly AssetLevelInput[],
): readonly ScenarioValidationIssue[] => {
  const issues: ScenarioValidationIssue[] = [];
  const occurrences = new Map<string, number>();

  if (levels.length !== ELS_ASSET_IDS.length) {
    issues.push({
      code: "INVALID_ASSET_COUNT",
      message: `기초자산은 정확히 ${ELS_ASSET_IDS.length}개여야 합니다.`,
    });
  }

  levels.forEach((level, index) => {
    occurrences.set(level.assetId, (occurrences.get(level.assetId) ?? 0) + 1);

    if (!isElsAssetId(level.assetId)) {
      issues.push({
        code: "UNKNOWN_ASSET",
        message: `지원하지 않는 기초자산입니다: ${level.assetId}`,
        assetId: level.assetId,
        index,
      });
    }

    if (!isValidBasisPoints(level.levelBp)) {
      issues.push({
        code: "INVALID_LEVEL",
        message: `${level.assetId}의 평가값은 ${MIN_LEVEL_BASIS_POINTS}~${MAX_LEVEL_BASIS_POINTS} 사이의 정수 bp여야 합니다.`,
        assetId: level.assetId,
        index,
      });
    }
  });

  occurrences.forEach((count, assetId) => {
    if (count > 1) {
      issues.push({
        code: "DUPLICATE_ASSET",
        message: `기초자산이 중복되었습니다: ${assetId}`,
        assetId,
      });
    }
  });

  ELS_ASSET_IDS.forEach((assetId) => {
    if (!occurrences.has(assetId)) {
      issues.push({
        code: "MISSING_ASSET",
        message: `필수 기초자산이 누락되었습니다: ${assetId}`,
        assetId,
      });
    }
  });

  return issues;
};

export const validateElsScenario = (
  input: ElsScenarioInput,
): ScenarioValidationResult => {
  const issues = validateLevels(input.levels);
  if (issues.length > 0) {
    return { valid: false, issues };
  }

  // Validation above proves every identifier and value has the narrower domain type.
  const levels: AssetLevel[] = input.levels.map((level) => ({
    assetId: level.assetId as ElsAssetId,
    levelBp: level.levelBp,
  }));

  return {
    valid: true,
    scenario: {
      id: input.id ?? VIRTUAL_ELS_SCENARIO_ID,
      name: input.name ?? DEFAULT_SCENARIO_NAME,
      levels,
    },
  };
};

export const createElsScenario = (input: ElsScenarioInput): ElsScenario => {
  const result = validateElsScenario(input);
  if (!result.valid) {
    throw new ElsScenarioValidationError(result.issues);
  }
  return result.scenario;
};

export const calculateAverageLevelBp = (
  levels: readonly AssetLevel[],
): BasisPoints =>
  Math.round(
    levels.reduce((sum, level) => sum + level.levelBp, 0) / levels.length,
  );

export const VIRTUAL_ELS_SCENARIO: ElsScenario = createElsScenario({
  id: VIRTUAL_ELS_SCENARIO_ID,
  name: DEFAULT_SCENARIO_NAME,
  levels: [
    { assetId: "KOSPI200", levelBp: 9_400 },
    { assetId: "SP500", levelBp: 9_300 },
    { assetId: "EUROSTOXX50", levelBp: 6_100 },
  ],
});

/** Levels ordered exactly as the product card should display them. */
export const getScenarioLevelsInProductOrder = (
  scenario: ElsScenario,
): readonly AssetLevel[] =>
  VIRTUAL_STEP_DOWN_ELS_PRODUCT.assets.map((asset) => {
    const level = scenario.levels.find((item) => item.assetId === asset.id);
    if (!level) {
      throw new ElsScenarioValidationError([
        {
          code: "MISSING_ASSET",
          message: `필수 기초자산이 누락되었습니다: ${asset.id}`,
          assetId: asset.id,
        },
      ]);
    }
    return level;
  });
