/**
 * ELS values are represented as integer basis points relative to the initial
 * index level. 10_000bp is 100%, 8_000bp is 80%, and so on.
 *
 * `BasisPoints` intentionally remains JSON-friendly. Runtime input must pass
 * the validators in `scenario.ts` before it is evaluated by the rule engine.
 */
export type BasisPoints = number;

export const PRINCIPAL_BASIS_POINTS = 10_000 as const;
export const MIN_LEVEL_BASIS_POINTS = 0 as const;
export const MAX_LEVEL_BASIS_POINTS = 20_000 as const;

export const ELS_ASSET_IDS = [
  "KOSPI200",
  "SP500",
  "EUROSTOXX50",
] as const;

export type ElsAssetId = (typeof ELS_ASSET_IDS)[number];

export interface ElsAssetDefinition {
  readonly id: ElsAssetId;
  readonly label: string;
}

export type MaturityObservationMethod = "WORST_OF";
export type FailureRedemptionMethod = "WORST_LEVEL";

export interface StepDownElsProduct {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly assets: readonly ElsAssetDefinition[];
  readonly maturity: {
    readonly observationMethod: MaturityObservationMethod;
    readonly barrierBp: BasisPoints;
    readonly successRedemptionBp: BasisPoints;
    readonly failureRedemptionMethod: FailureRedemptionMethod;
  };
}

/** Untrusted/API-facing scenario level before runtime validation. */
export interface AssetLevelInput {
  readonly assetId: string;
  readonly levelBp: number;
}

/** A validated scenario level. */
export interface AssetLevel {
  readonly assetId: ElsAssetId;
  readonly levelBp: BasisPoints;
}

export interface ElsScenarioInput {
  readonly id?: string;
  readonly name?: string;
  readonly levels: readonly AssetLevelInput[];
}

export interface ElsScenario {
  readonly id: string;
  readonly name: string;
  readonly levels: readonly AssetLevel[];
}

export type ScenarioValidationIssueCode =
  | "INVALID_ASSET_COUNT"
  | "UNKNOWN_ASSET"
  | "DUPLICATE_ASSET"
  | "MISSING_ASSET"
  | "INVALID_LEVEL";

export interface ScenarioValidationIssue {
  readonly code: ScenarioValidationIssueCode;
  readonly message: string;
  readonly assetId?: string;
  readonly index?: number;
}

export type ScenarioValidationResult =
  | {
      readonly valid: true;
      readonly scenario: ElsScenario;
    }
  | {
      readonly valid: false;
      readonly issues: readonly ScenarioValidationIssue[];
    };

export type Outcome = "PROFIT" | "PRINCIPAL" | "LOSS";
export type PredictedOutcome = Outcome | "UNSURE";

export interface MaturityEvaluation {
  readonly productId: string;
  readonly scenarioId: string;
  readonly observationMethod: MaturityObservationMethod;
  readonly levels: readonly AssetLevel[];
  readonly worstLevelBp: BasisPoints;
  readonly worstLevelDisplay: string;
  /** All assets are included when the minimum level is tied. */
  readonly worstAssetIds: readonly ElsAssetId[];
  /** Rounded to the nearest integer bp and included for display only. */
  readonly averageLevelBp: BasisPoints;
  readonly averageLevelDisplay: string;
  readonly averageUsedForOutcome: false;
  readonly barrierBp: BasisPoints;
  readonly barrierMet: boolean;
  readonly redemptionBp: BasisPoints;
  readonly redemptionDisplay: string;
  /** Redemption minus principal: e.g. 6_100bp redemption -> -3_900bp return. */
  readonly returnRateBp: number;
  readonly returnRateDisplay: string;
  readonly outcome: Outcome;
}

export type PredictionComparisonStatus = "MATCH" | "MISMATCH" | "UNSURE";

export interface PredictionComparison {
  readonly prediction: PredictedOutcome;
  readonly actualOutcome: Outcome;
  readonly status: PredictionComparisonStatus;
  /** `null` means the user selected `UNSURE`. */
  readonly isMatch: boolean | null;
}
