import type { StepDownElsProduct } from "./types";

export const VIRTUAL_STEP_DOWN_ELS_PRODUCT = {
  id: "virtual-stepdown-els-001",
  name: "가상 Step-down ELS 001",
  description:
    "세 기초자산 중 만기 수익률이 가장 낮은 자산(Worst-of)을 기준으로 상환 결과를 결정하는 교육용 가상 상품입니다.",
  assets: [
    { id: "KOSPI200", label: "KOSPI200" },
    { id: "SP500", label: "S&P500" },
    { id: "EUROSTOXX50", label: "EuroStoxx50" },
  ],
  maturity: {
    observationMethod: "WORST_OF",
    barrierBp: 8_000,
    successRedemptionBp: 10_800,
    failureRedemptionMethod: "WORST_LEVEL",
  },
} as const satisfies StepDownElsProduct;

export const VIRTUAL_STEP_DOWN_ELS_PRODUCT_ID =
  VIRTUAL_STEP_DOWN_ELS_PRODUCT.id;

export const getElsAsset = (assetId: string) =>
  VIRTUAL_STEP_DOWN_ELS_PRODUCT.assets.find((asset) => asset.id === assetId);
