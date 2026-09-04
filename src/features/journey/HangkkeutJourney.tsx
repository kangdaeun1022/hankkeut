"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import {
  VIRTUAL_STEP_DOWN_ELS_PRODUCT,
} from "@/domain/els/product";
import {
  VIRTUAL_ELS_SCENARIO,
} from "@/domain/els/scenario";
import { comparePrediction } from "@/domain/els/comparison";
import { evaluateVirtualElsMaturity } from "@/domain/els/rule-engine";
import type {
  MaturityEvaluation,
  PredictedOutcome,
  PredictionComparison,
} from "@/domain/els/types";
import type {
  AnalyzeResponse,
  UnderstandingAnalysis,
} from "@/server/ai/schema";

const SAMPLE_TEXT =
  "세 지수는 평균적으로 보는 걸로 이해했어요. 하나가 많이 떨어져도 다른 두 지수가 괜찮으면 되는 거 아닌가요?";

type JourneyStep =
  | "PRODUCT"
  | "INPUT"
  | "ANALYSIS"
  | "DIFF"
  | "SCENARIO"
  | "RESULT";

interface CalculationResponse {
  evaluation: MaturityEvaluation;
  comparison: PredictionComparison;
  meta: {
    engine: string;
    rulesVersion: string;
  };
}

const journeySteps: readonly JourneyStep[] = [
  "PRODUCT",
  "INPUT",
  "ANALYSIS",
  "DIFF",
  "SCENARIO",
  "RESULT",
];

const progressItems = [
  { label: "상품 확인", steps: ["PRODUCT"] },
  { label: "말해보기", steps: ["INPUT"] },
  { label: "한끗 찾기", steps: ["ANALYSIS", "DIFF"] },
  { label: "결과 확인", steps: ["SCENARIO", "RESULT"] },
] as const;

const predictionOptions: ReadonlyArray<{
  id: PredictedOutcome;
  title: string;
  description: string;
}> = [
  { id: "PROFIT", title: "수익 발생", description: "원금과 수익을 받는다" },
  { id: "PRINCIPAL", title: "원금 수준", description: "원금만 돌려받는다" },
  { id: "LOSS", title: "손실 발생", description: "원금 손실이 발생한다" },
  { id: "UNSURE", title: "잘 모르겠어요", description: "결과를 판단하기 어렵다" },
];

const predictionLabels: Record<PredictedOutcome, string> = {
  PROFIT: "수익 발생",
  PRINCIPAL: "원금 수준",
  LOSS: "손실 발생",
  UNSURE: "잘 모르겠어요",
};

const assetLabels = Object.fromEntries(
  VIRTUAL_STEP_DOWN_ELS_PRODUCT.assets.map((asset) => [asset.id, asset.label]),
);

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className={direction === "left" ? "icon icon-left" : "icon"}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" className="spark-icon" viewBox="0 0 24 24" fill="none">
      <path d="M12 2c.6 5.7 4.3 9.4 10 10-5.7.6-9.4 4.3-10 10-.6-5.7-4.3-9.4-10-10 5.7-.6 9.4-4.3 10-10Z" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="small-icon" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 5 6v5c0 4.7 2.9 8.4 7 10 4.1-1.6 7-5.3 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="small-icon" viewBox="0 0 24 24" fill="none">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <button className="brand" onClick={onReset} aria-label="한끗 처음으로">
          <span className="brand-mark">한</span>
          <span className="brand-name">한끗</span>
        </button>
        <div className="challenge-label">
          <span className="live-dot" />
          2026 금융 AI Challenge
        </div>
      </div>
    </header>
  );
}

function Progress({ currentStep }: { currentStep: JourneyStep }) {
  const currentIndex = journeySteps.indexOf(currentStep);

  return (
    <nav className="progress" aria-label="진행 단계">
      {progressItems.map((item, index) => {
        const itemIndexes = item.steps.map((step) => journeySteps.indexOf(step));
        const isActive = item.steps.includes(currentStep as never);
        const isComplete = Math.max(...itemIndexes) < currentIndex;

        return (
          <div
            className={`progress-item ${isActive ? "is-active" : ""} ${isComplete ? "is-complete" : ""}`}
            key={item.label}
          >
            <span className="progress-number">
              {isComplete ? <CheckIcon /> : index + 1}
            </span>
            <span>{item.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

function BackButton({ onClick, label = "이전" }: { onClick: () => void; label?: string }) {
  return (
    <button className="back-button" onClick={onClick} type="button">
      <ArrowIcon direction="left" />
      {label}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      className="primary-button"
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
    >
      {loading ? (
        <>
          <span className="spinner" />
          분석 중
        </>
      ) : (
        <>
          {children}
          <ArrowIcon />
        </>
      )}
    </button>
  );
}

function ProductStage({ onNext }: { onNext: () => void }) {
  return (
    <div className="stage stage-product">
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">설명 이후를 확인하는 금융 AI</p>
          <h1>
            설명과 이해 사이,
            <br />
            결과를 바꾸는 <span className="highlight-word">한끗</span>
          </h1>
          <p className="hero-description">
            상품을 읽었다는 확인에서 멈추지 않습니다. 내 말로 설명하면 AI가
            계약과 다른 이해를 찾고, 그 차이가 결과를 어떻게 바꾸는지 보여줘요.
          </p>
          <div className="hero-actions">
            <PrimaryButton onClick={onNext}>한끗 찾아보기</PrimaryButton>
            <span className="time-note">약 2분 · 로그인 없이 체험</span>
          </div>
        </div>

        <div className="concept-card" aria-label="한끗 작동 방식">
          <div className="concept-topline">
            <span className="mini-label">UNDERSTANDING CHECK</span>
            <span className="concept-dots"><i /><i /><i /></span>
          </div>
          <div className="message message-user">
            <span className="message-role">나의 이해</span>
            “한 지수가 많이 떨어져도 다른 두 개가 괜찮으면 되는 거 아닌가요?”
          </div>
          <div className="analysis-path">
            <span><SparkIcon /> AI 의미 분석</span>
            <i />
            <span><ShieldIcon /> Rule Engine 계산</span>
          </div>
          <div className="message message-result">
            <span className="result-kicker">결과를 바꾼 한끗</span>
            평균이 아니라 가장 낮은 기초자산이 결과를 결정합니다.
          </div>
        </div>
      </section>

      <section className="product-card" aria-labelledby="product-title">
        <div className="product-heading">
          <div>
            <div className="product-badges">
              <span className="badge badge-dark">가상상품</span>
              <span className="badge badge-soft">만기 시나리오</span>
            </div>
            <p className="section-kicker">오늘 확인할 상품</p>
            <h2 id="product-title">가상 Step-down ELS 001</h2>
          </div>
          <div className="coupon-block">
            <span>조건 충족 시</span>
            <strong>+8%</strong>
            <small>만기 총수익률</small>
          </div>
        </div>

        <div className="asset-strip" aria-label="기초자산">
          {VIRTUAL_STEP_DOWN_ELS_PRODUCT.assets.map((asset, index) => (
            <div className="asset-chip" key={asset.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{asset.label}</strong>
            </div>
          ))}
        </div>

        <div className="terms-grid">
          <article className="term-item term-featured">
            <span className="term-number">01</span>
            <p>판단 기준</p>
            <h3>가장 낮은 값</h3>
            <span>Worst-of</span>
          </article>
          <article className="term-item">
            <span className="term-number">02</span>
            <p>만기 상환 기준</p>
            <h3>80% 이상</h3>
            <span>최초 기준가 대비</span>
          </article>
          <article className="term-item">
            <span className="term-number">03</span>
            <p>기준 충족 시</p>
            <h3>원금 + 8%</h3>
            <span>상환율 108%</span>
          </article>
          <article className="term-item">
            <span className="term-number">04</span>
            <p>기준 미충족 시</p>
            <h3>하락률 반영</h3>
            <span>Worst-of 기준</span>
          </article>
        </div>

        <div className="scope-note">
          <ShieldIcon />
          <p>
            <strong>이해검증용 단순화 사례예요.</strong> 이번 MVP는 만기
            Worst-of 규칙만 계산하며, 조기상환·Knock-In 경로는 계산 범위에
            포함하지 않습니다.
          </p>
        </div>
      </section>
    </div>
  );
}

function InputStage({
  text,
  setText,
  onBack,
  onSubmit,
  loading,
  error,
}: {
  text: string;
  setText: (text: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="stage stage-centered">
      <BackButton onClick={onBack} label="상품 조건 다시 보기" />
      <section className="prompt-card">
        <div className="step-symbol"><span>말</span></div>
        <p className="section-kicker">말해보기</p>
        <h1>이 상품을 어떻게 이해했나요?</h1>
        <p className="stage-description">
          정답을 맞히려 하지 말고, 손실이 언제 발생한다고 이해했는지 그대로
          적어주세요.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="textarea-label" htmlFor="understanding">
            내가 이해한 내용
            <span>{text.length}/500</span>
          </label>
          <div className={`textarea-wrap ${error ? "has-error" : ""}`}>
            <textarea
              autoFocus
              id="understanding"
              maxLength={500}
              onChange={(event) => setText(event.target.value)}
              placeholder="예: 한 지수가 많이 떨어져도 나머지 지수가 괜찮으면 되는 걸로 이해했어요."
              rows={7}
              value={text}
            />
            <button
              className="sample-button"
              onClick={() => setText(SAMPLE_TEXT)}
              type="button"
            >
              샘플 문장 채우기
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="privacy-note">
            <ShieldIcon /> 이름·계좌·투자금액 없이 입력 문장만 분석해요.
          </div>
          <div className="form-action">
            <PrimaryButton
              disabled={text.trim().length < 8}
              loading={loading}
              type="submit"
            >
              AI로 분석하기
            </PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function AnalysisStage({
  result,
  onBack,
  onNext,
}: {
  result: AnalyzeResponse;
  onBack: () => void;
  onNext: () => void;
}) {
  const { analysis, meta } = result;
  const isUnclear = analysis.status !== "SUPPORTED";

  return (
    <div className="stage stage-centered">
      <BackButton onClick={onBack} label="내 설명 수정하기" />
      <section className="analysis-card">
        <div className="analysis-orbit"><SparkIcon /></div>
        <div className="analysis-heading">
          <p className="section-kicker">AI 이해 분석</p>
          <h1>{isUnclear ? "한끗을 단정하지 않았어요" : "AI가 이렇게 이해했어요"}</h1>
          <div className={`mode-badge mode-${meta.mode}`}>
            <span />
            {meta.mode === "live" ? "생성형 AI 분석" : "안전 데모 분석"}
          </div>
        </div>

        {isUnclear ? (
          <div className="unclear-state">
            <ShieldIcon />
            <h2>판단할 근거가 충분하지 않아요</h2>
            <p>{analysis.summary}</p>
            <button className="secondary-button" onClick={onBack} type="button">
              내용을 더 구체적으로 적기
            </button>
          </div>
        ) : (
          <>
            <div className="analysis-summary">
              <div className="rule-chip">
                <span>확인한 규칙</span>
                <strong>Worst-of 판단 기준</strong>
              </div>
              <p>{analysis.summary}</p>
            </div>

            <blockquote className="evidence-box">
              <span>입력에서 찾은 근거</span>
              “{analysis.evidence}”
            </blockquote>

            <details className="structure-details">
              <summary>AI 구조화 결과 보기</summary>
              <dl>
                <div><dt>ruleId</dt><dd>{analysis.ruleId}</dd></div>
                <div><dt>understanding</dt><dd>{analysis.understanding}</dd></div>
                <div><dt>evidence</dt><dd>{analysis.evidence}</dd></div>
              </dl>
            </details>

            {meta.notice ? <p className="mode-notice">{meta.notice}</p> : null}
            <div className="form-action">
              <PrimaryButton onClick={onNext}>
                실제 계약조건과 비교하기
              </PrimaryButton>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DiffStage({
  analysis,
  onBack,
  onNext,
}: {
  analysis: UnderstandingAnalysis;
  onBack: () => void;
  onNext: () => void;
}) {
  const hasMismatch = analysis.understanding === "AVERAGE";
  const userBasis = hasMismatch
    ? "세 지수의 평균"
    : "세 지수 중 가장 낮은 값";

  return (
    <div className="stage stage-centered stage-wide">
      <BackButton onClick={onBack} label="AI 분석 다시 보기" />
      <section className="diff-section">
        <div className="title-block">
          <p className="section-kicker">결과를 바꿀 수 있는 한끗</p>
          <h1>
            {hasMismatch
              ? "기준 하나가 다르게 이해됐어요"
              : "계약 기준과 같은 방향으로 이해했어요"}
          </h1>
          <p>단어 하나의 차이가 아니라, 결과를 판단하는 규칙의 차이예요.</p>
        </div>

        <div className="diff-grid">
          <article className="basis-card basis-user">
            <span className="basis-label">내가 이해한 기준</span>
            <div className="basis-visual visual-average">
              <i /><i /><i />
              <span>평균</span>
            </div>
            <h2>{userBasis}</h2>
            <p>
              {hasMismatch
                ? "다른 두 지수가 높으면 한 지수의 하락을 만회한다고 이해했어요."
                : "가장 낮은 지수 하나가 결과에 영향을 준다고 이해했어요."}
            </p>
          </article>

          <div className="diff-marker" aria-hidden="true">
            <span>한끗</span>
            <ArrowIcon />
          </div>

          <article className="basis-card basis-contract">
            <span className="basis-label">실제 계약 기준</span>
            <div className="basis-visual visual-worst">
              <i /><i /><i />
              <span>최저</span>
            </div>
            <h2>세 지수 중 가장 낮은 값</h2>
            <p>가장 낮은 기초자산 하나가 전체 상환 결과를 결정해요.</p>
          </article>
        </div>

        <div className="key-insight">
          <SparkIcon />
          <p>
            <strong>{hasMismatch ? "여기가 결과를 바꾸는 한끗이에요." : "기준은 잘 짚었어요."}</strong>
            평균이 80%를 넘더라도 가장 낮은 지수가 80% 미만이면 손실이 발생할
            수 있습니다.
          </p>
        </div>

        <div className="form-action">
          <PrimaryButton onClick={onNext}>가상 상황에서 확인하기</PrimaryButton>
        </div>
      </section>
    </div>
  );
}

function ScenarioStage({
  prediction,
  setPrediction,
  onBack,
  onSubmit,
  loading,
  error,
}: {
  prediction: PredictedOutcome | null;
  setPrediction: (prediction: PredictedOutcome) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="stage stage-centered stage-wide">
      <BackButton onClick={onBack} label="한끗 비교 다시 보기" />
      <section className="scenario-section">
        <div className="title-block">
          <div className="scenario-tag">가상 상황 · 만기 평가일</div>
          <h1>이 상황에서 결과를 예상해보세요</h1>
          <p>세 기초자산이 최초 기준가 대비 다음과 같다면 어떤 결과가 나올까요?</p>
        </div>

        <div className="market-card">
          <div className="market-header">
            <span>기초자산 만기 수준</span>
            <small>최초 기준가 = 100%</small>
          </div>
          <div className="market-levels">
            {VIRTUAL_ELS_SCENARIO.levels.map((level) => {
              const percentage = level.levelBp / 100;
              return (
                <div className="market-row" key={level.assetId}>
                  <div className="market-name">
                    <strong>{assetLabels[level.assetId]}</strong>
                    <span>최초 기준가 대비</span>
                  </div>
                  <div className="level-track" aria-hidden="true">
                    <i style={{ "--bar-width": `${Math.min(percentage, 100)}%` } as CSSProperties} />
                  </div>
                  <strong className="level-value">{percentage}%</strong>
                </div>
              );
            })}
          </div>
        </div>

        <fieldset className="prediction-fieldset">
          <legend>어떤 결과가 나올까요?</legend>
          <div className="prediction-grid">
            {predictionOptions.map((option) => (
              <label
                className={`prediction-option ${prediction === option.id ? "is-selected" : ""}`}
                key={option.id}
              >
                <input
                  checked={prediction === option.id}
                  name="prediction"
                  onChange={() => setPrediction(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span className="radio-mark" />
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? <p className="form-error centered-error" role="alert">{error}</p> : null}
        <div className="form-action">
          <PrimaryButton
            disabled={!prediction}
            loading={loading}
            onClick={onSubmit}
          >
            실제 결과 확인하기
          </PrimaryButton>
        </div>
        <p className="engine-note"><ShieldIcon /> 금융 결과는 생성형 AI가 아닌 고정 Rule Engine이 계산합니다.</p>
      </section>
    </div>
  );
}

function ResultStage({
  prediction,
  result,
  onReset,
}: {
  prediction: PredictedOutcome;
  result: CalculationResponse;
  onReset: () => void;
}) {
  const { evaluation, comparison } = result;
  const worstAsset = evaluation.worstAssetIds
    .map((id) => assetLabels[id])
    .join(", ");
  const redemptionWon = Math.round(
    (1_000_000 * evaluation.redemptionBp) / 10_000,
  ).toLocaleString("ko-KR");
  const averageDisplay = `${(evaluation.averageLevelBp / 100).toFixed(1)}%`;
  const resultTitle =
    comparison.status === "MATCH"
      ? "예상과 실제 결과가 같아요"
      : comparison.status === "MISMATCH"
        ? "예상과 실제 결과가 달랐어요"
        : "실제 계약 결과를 확인해보세요";

  return (
    <div className="stage stage-centered stage-wide">
      <section className="result-section">
        <div className="result-heading">
          <span className={`result-status status-${comparison.status.toLowerCase()}`}>
            {comparison.status === "MATCH" ? "예상 일치" : comparison.status === "MISMATCH" ? "예상 차이 발견" : "결과 확인"}
          </span>
          <h1>{resultTitle}</h1>
          <p>같은 숫자도 어떤 계약 기준을 적용하느냐에 따라 결과가 달라집니다.</p>
        </div>

        <div className="outcome-grid">
          <article className="outcome-card outcome-user">
            <span>내가 예상한 결과</span>
            <strong>{predictionLabels[prediction]}</strong>
            <small>사용자 선택</small>
          </article>
          <div className="outcome-arrow"><ArrowIcon /></div>
          <article className="outcome-card outcome-actual">
            <span>실제 계약 결과</span>
            <strong>원금 손실 {evaluation.returnRateDisplay}</strong>
            <small>원금의 {evaluation.redemptionDisplay} 상환</small>
          </article>
        </div>

        <div className="calculation-panel">
          <div className="calculation-result">
            <span>Rule Engine 산출</span>
            <strong>{evaluation.returnRateDisplay}</strong>
            <p>원금 100만원 가정 시 {redemptionWon}원 상환</p>
          </div>
          <ol className="calculation-steps">
            <li>
              <span>1</span>
              <p>가장 낮은 지수는 <strong>{worstAsset} {evaluation.worstLevelDisplay}</strong>입니다.</p>
            </li>
            <li>
              <span>2</span>
              <p>만기 상환 기준 <strong>80%</strong>를 충족하지 못했습니다.</p>
            </li>
            <li>
              <span>3</span>
              <p>Worst-of 하락률이 반영되어 <strong>{evaluation.returnRateDisplay} 손실</strong>입니다.</p>
            </li>
          </ol>
        </div>

        <div className="final-insight">
          <div className="final-insight-label"><SparkIcon /> 결과를 바꾼 한끗</div>
          <h2>
            핵심은 평균 <em>{averageDisplay}</em>가 아니라
            <br />Worst-of <em>{evaluation.worstLevelDisplay}</em>입니다.
          </h2>
          <p>세 기초자산의 평균이 아니라 가장 낮은 기초자산이 결과를 결정합니다.</p>
        </div>

        <div className="result-footer">
          <div className="engine-proof">
            <ShieldIcon />
            <span>
              <strong>AI와 계산을 분리했습니다</strong>
              {result.meta.rulesVersion} · deterministic Rule Engine
            </span>
          </div>
          <button className="restart-button" onClick={onReset} type="button">
            처음부터 다시 보기
            <ArrowIcon />
          </button>
        </div>
      </section>
    </div>
  );
}

export function HangkkeutJourney() {
  const [step, setStep] = useState<JourneyStep>("PRODUCT");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictedOutcome | null>(null);
  const [calculationResult, setCalculationResult] = useState<CalculationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveTo = useCallback((nextStep: JourneyStep) => {
    setError(null);
    setStep(nextStep);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  const reset = useCallback(() => {
    setText(SAMPLE_TEXT);
    setAnalysisResult(null);
    setPrediction(null);
    setCalculationResult(null);
    setLoading(false);
    moveTo("PRODUCT");
  }, [moveTo]);

  const analyze = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length < 8) {
      setError("이해한 내용을 조금 더 자세히 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const payload = (await response.json()) as AnalyzeResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "분석을 완료하지 못했습니다.");
      setAnalysisResult(payload);
      moveTo("ANALYSIS");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }, [moveTo, text]);

  const calculate = useCallback(async () => {
    if (!prediction) {
      setError("예상하는 결과를 하나 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const evaluation = evaluateVirtualElsMaturity(VIRTUAL_ELS_SCENARIO);
      setCalculationResult({
        evaluation,
        comparison: comparePrediction(prediction, evaluation.outcome),
        meta: {
          engine: "deterministic-rule-engine",
          rulesVersion: "2026-09-mvp.1",
        },
      });
      moveTo("RESULT");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }, [moveTo, prediction]);

  const stage = useMemo(() => {
    switch (step) {
      case "PRODUCT":
        return <ProductStage onNext={() => moveTo("INPUT")} />;
      case "INPUT":
        return (
          <InputStage
            error={error}
            loading={loading}
            onBack={() => moveTo("PRODUCT")}
            onSubmit={analyze}
            setText={setText}
            text={text}
          />
        );
      case "ANALYSIS":
        return analysisResult ? (
          <AnalysisStage
            onBack={() => moveTo("INPUT")}
            onNext={() => moveTo("DIFF")}
            result={analysisResult}
          />
        ) : null;
      case "DIFF":
        return analysisResult ? (
          <DiffStage
            analysis={analysisResult.analysis}
            onBack={() => moveTo("ANALYSIS")}
            onNext={() => moveTo("SCENARIO")}
          />
        ) : null;
      case "SCENARIO":
        return (
          <ScenarioStage
            error={error}
            loading={loading}
            onBack={() => moveTo("DIFF")}
            onSubmit={calculate}
            prediction={prediction}
            setPrediction={setPrediction}
          />
        );
      case "RESULT":
        return prediction && calculationResult ? (
          <ResultStage
            onReset={reset}
            prediction={prediction}
            result={calculationResult}
          />
        ) : null;
    }
  }, [
    analysisResult,
    analyze,
    calculate,
    calculationResult,
    error,
    loading,
    moveTo,
    prediction,
    reset,
    step,
    text,
  ]);

  return (
    <div className="app-frame">
      <Header onReset={reset} />
      <main className="shell main-content">
        <Progress currentStep={step} />
        <div className="stage-frame" key={step}>{stage}</div>
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <div><strong>한끗</strong><span>설명과 이해 사이</span></div>
          <p>본 서비스의 상품과 수치는 이해검증을 위한 가상 사례이며 투자 권유가 아닙니다.</p>
        </div>
      </footer>
    </div>
  );
}
