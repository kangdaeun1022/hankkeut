"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
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
  { label: "계약 확인", steps: ["PRODUCT"] },
  { label: "나의 이해", steps: ["INPUT", "ANALYSIS"] },
  { label: "한끗 비교", steps: ["DIFF"] },
  { label: "이해 검증", steps: ["SCENARIO", "RESULT"] },
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

function CrossIcon() {
  return (
    <svg aria-hidden="true" className="small-icon" viewBox="0 0 24 24" fill="none">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
    <motion.button
      className="primary-button"
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      whileHover={disabled || loading ? undefined : { y: -3, scale: 1.015 }}
      whileTap={disabled || loading ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
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
    </motion.button>
  );
}

function ProductStage({ onNext }: { onNext: () => void }) {
  return (
    <div className="stage stage-product">
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">가상 Step-down ELS · 90초 이해 점검</p>
          <h1>
            이 상품,
            <br />
            <span className="highlight-word">이해하셨나요?</span>
          </h1>
          <p className="hero-description">
            세 지수를 평균으로 볼지, 가장 낮은 값으로 볼지. 실제 계약의 한 단어가
            만기 결과를 어떻게 바꾸는지 직접 확인해보세요.
          </p>
          <div className="hero-actions">
            <PrimaryButton onClick={onNext}>내 이해 확인하기</PrimaryButton>
            <span className="time-note">약 90초 · 로그인 없이 체험</span>
          </div>
        </div>

        <div className="concept-card contract-snapshot" aria-label="가상 Step-down ELS 계약 요약">
          <div className="concept-topline">
            <span className="mini-label">계약 핵심 조건</span>
            <span className="contract-page">01 / 01</span>
          </div>
          <div className="contract-title">
            <span>가상상품 · 만기 기준</span>
            <strong>Step-down ELS 001</strong>
          </div>
          <div className="contract-line"><span>기초자산</span><strong>세 지수</strong></div>
          <div className="contract-line"><span>만기 상환 기준</span><strong>80% 이상</strong></div>
          <div className="contract-line"><span>기준 충족 시</span><strong>원금 + 8%</strong></div>
          <div className="contract-line contract-line-emphasis"><span>평가 기준</span><strong>가장 낮은 값</strong></div>
          <div className="contract-prompt">
            <span className="contract-note-mark" aria-hidden="true" />
            세 자산의 평균이 아닌, 가장 낮은 값이 기준입니다.
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
        <p className="section-kicker">YOUR INTERPRETATION</p>
        <h1>이 상품에서 언제 손실이 발생한다고 이해하셨나요?</h1>
        <p className="stage-description">
          정답을 맞히려 하지 말고, 손실이 발생하는 조건을 어떻게 이해했는지
          그대로 적어주세요.
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
              데모 문장 불러오기
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
  sourceText,
  onBack,
  onNext,
}: {
  result: AnalyzeResponse;
  sourceText: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const { analysis, meta } = result;
  const isUnclear = analysis.status !== "SUPPORTED";
  const hasMismatch = analysis.understanding === "AVERAGE";
  const keyword = analysis.evidence.includes("평균")
    ? "평균적으로"
    : analysis.evidence || "판단 기준";

  return (
    <div className="stage stage-centered">
      <BackButton onClick={onBack} label="내 설명 수정하기" />
      <section className="analysis-card">
        <div className="analysis-orbit"><SparkIcon /></div>
        <div className="analysis-heading">
          <p className="section-kicker">AI가 찾은 이해의 근거</p>
          <h1>{isUnclear ? "한끗을 단정하지 않았어요" : hasMismatch ? "계약과 다른 기준을 찾았어요" : "계약 기준을 정확히 찾았어요"}</h1>
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
            <div className={`sentence-decomposition ${hasMismatch ? "is-mismatch" : "is-match"}`} aria-label="AI가 사용자 문장에서 찾은 핵심 표현">
              <p className="decomposition-label">입력 문장에서 찾은 표현</p>
              <motion.p
                animate="visible"
                initial="hidden"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
                }}
              >
                {sourceText.split(/(평균적으로|평균|가장 낮은|최저값)/).filter(Boolean).map((part, index) => (
                  <motion.span
                    className={part.includes("평균") || part.includes("낮은") || part.includes("최저") ? "is-keyword" : ""}
                    key={`${part}-${index}`}
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  >
                    {part}
                  </motion.span>
                ))}
              </motion.p>
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="conflict-signal"
                initial={{ opacity: 0, scale: 0.94 }}
                transition={{ delay: 0.55, type: "spring", stiffness: 280, damping: 22 }}
              >
                <span>{hasMismatch ? <CrossIcon /> : <CheckIcon />}</span>
                <div>
                  <strong>{hasMismatch ? "계약 기준과 차이" : "계약 기준과 일치"}</strong>
                  <small>AI가 “{keyword}”를 핵심 표현으로 잡았습니다.</small>
                </div>
              </motion.div>
            </div>
            <div className="analysis-summary">
              <div className="rule-chip">
                <span>{hasMismatch ? "실제 계약 규칙" : "확인된 계약 규칙"}</span>
                <strong>가장 낮은 값으로 판단</strong>
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
                {hasMismatch ? "실제 계약조건과 비교하기" : "같은 기준으로 결과 확인하기"}
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
  const [split, setSplit] = useState(50);
  const actualDominates = split < 42;
  const myMeasure = hasMismatch ? "세 자산의 평균" : "가장 낮은 자산";
  const myRule = hasMismatch ? "(A + B + C) / 3" : "WORST(A, B, C)";
  const myLevel = hasMismatch ? "82.7%" : "61.0%";
  const myOutcome = hasMismatch ? "+8.0%" : "-39.0%";
  const connectorCopy = hasMismatch ? "해석 차이" : "같은 해석";

  return (
    <div className="stage stage-centered stage-wide one-difference-stage">
      <BackButton onClick={onBack} label="AI 분석 다시 보기" />
      <section className="one-difference-panel">
        <div className="one-difference-heading">
          <div>
            <p className="section-kicker">THE ONE-DIFFERENCE EXPERIENCE</p>
            <h1>
              {hasMismatch ? <>평균 <em>│</em> 최저값</> : <>최저값 <em>=</em> 최저값</>}
            </h1>
          </div>
          <p>{hasMismatch ? "비교선을 움직여, 내가 이해한 기준과 실제 계약 기준을 나란히 확인해보세요." : "내가 이해한 기준과 실제 계약 기준이 같은지 확인해보세요."}</p>
        </div>

        <div className={`contract-compare ${hasMismatch ? "is-mismatch" : "is-match"}`}>
          <article className="compare-world compare-world-mine">
            <span className="world-kicker">내가 이해한 기준</span>
            <p className="world-caption">{myMeasure}</p>
            <strong className="world-rule">{myRule}</strong>
            <motion.span animate={{ opacity: actualDominates ? 0.48 : 1 }} className="world-number">{myLevel}</motion.span>
            <span className={`world-result ${hasMismatch ? "world-result-profit" : "world-result-loss"}`}>
              {hasMismatch ? <CheckIcon /> : <CrossIcon />}
              {hasMismatch ? "수익 조건 충족" : "조건 미충족"}
            </span>
            <small>{hasMismatch ? "평균 기준이면 +8% 수익" : "최저값 기준이면 -39% 손실"}</small>
          </article>

          <article
            className="compare-world compare-world-contract"
            style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          >
            <div className="contract-world-content">
              <span className="world-kicker">실제 계약 기준</span>
              <p className="world-caption">가장 낮은 자산</p>
              <strong className="world-rule">WORST(A, B, C)</strong>
              <motion.span animate={{ opacity: actualDominates ? 1 : 0.72 }} className="world-number">61.0%</motion.span>
              <span className="world-result world-result-loss"><CrossIcon /> 조건 미충족</span>
              <small>Worst-of 기준이면 -39% 손실</small>
            </div>
          </article>

          <motion.div animate={{ left: `${split}%` }} className="compare-divider" transition={{ type: "spring", stiffness: 360, damping: 34 }}>
            <span>한끗</span>
            <i />
            <span className="compare-handle" aria-hidden="true">↔</span>
          </motion.div>
          <label className="compare-control" htmlFor="comparison-split">
            <span>비교선 위치</span>
            <input
              aria-describedby="comparison-help"
              aria-valuetext={`내 이해 ${Math.round(split)}%, 실제 계약 ${100 - Math.round(split)}% 보기`}
              id="comparison-split"
              max="82"
              min="18"
              onChange={(event) => setSplit(Number(event.target.value))}
              type="range"
              value={split}
            />
          </label>
        </div>
        <p className="compare-help" id="comparison-help">드래그하거나 방향키로 비교선을 움직일 수 있어요.</p>

        <div className={`outcome-flip ${hasMismatch ? "is-mismatch" : "is-match"}`} data-actual={actualDominates}>
          <div><span>내 이해의 결과</span><strong>{myOutcome}</strong></div>
          <i>│</i>
          <div><span>실제 계약 결과</span><strong>-39.0%</strong></div>
          <p>{hasMismatch ? "판단 기준 한 단어가 결과를 바꿨습니다." : "판단 기준을 정확히 이해했습니다."}</p>
        </div>

        <div className="xray-grid">
          <article className="xray-card xray-user">
            <span>01 / 고객이 이해한 내용</span>
            <p>“{analysis.evidence || "세 자산의 평균이 기준 이상이면 수익을 받는 상품"}”</p>
            <strong>{hasMismatch ? "평균적으로" : "가장 낮은 값"}</strong>
          </article>
          <div className={`xray-connector ${hasMismatch ? "is-mismatch" : "is-match"}`} aria-hidden="true">
            <span>{connectorCopy}</span><i />{hasMismatch ? <CrossIcon /> : <CheckIcon />}
          </div>
          <article className="xray-card xray-contract">
            <span>02 / 실제 계약 조건</span>
            <p>“기초자산 중 평가가격이 가장 낮은 종목을 기준으로 만기 상환을 판단합니다.”</p>
            <strong>가장 낮은 종목</strong>
          </article>
        </div>

        <div className="engine-flow">
          <div className="engine-flow-heading"><ShieldIcon /><span>EXPLAINABLE RULE ENGINE</span><small>AI는 오해 후보만 탐지하고, 계산은 규칙이 수행합니다.</small></div>
          <ol>
            <li><span>AI 해석</span><strong>{hasMismatch ? "평균 기준 감지" : "최저값 기준 감지"}</strong></li>
            <li><span>계약 규칙</span><strong>Worst(KOSPI, S&amp;P, EURO) = 61%</strong></li>
            <li><span>80% 기준 확인</span><strong>61% &lt; 80%</strong></li>
            <li className="engine-loss"><span>ACTUAL RESULT</span><strong>LOSS CONDITION</strong></li>
          </ol>
        </div>

        <div className="form-action">
          <PrimaryButton onClick={onNext}>가상 상황에서 결과 예상하기</PrimaryButton>
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
          <div className="scenario-tag">UNDERSTANDING CHECK · 만기 평가일</div>
          <h1>이제 정말 이해하셨나요?</h1>
          <p>평균이 아닌 Worst-of 기준으로, 이 상황의 계약 결과를 예상해보세요.</p>
        </div>

        <div className="market-card market-rig">
          <div className="market-rig-head"><span>MARKET AT MATURITY</span><small>최초 기준가 = 100%</small></div>
          <div className="contract-barrier"><span>80% CONTRACT BARRIER</span></div>
          <div className="asset-towers">
            {VIRTUAL_ELS_SCENARIO.levels.map((level) => {
              const percentage = level.levelBp / 100;
              const isWorst = level.levelBp === Math.min(...VIRTUAL_ELS_SCENARIO.levels.map((item) => item.levelBp));
              return (
                <article className={`asset-tower ${isWorst ? "is-worst" : ""}`} key={level.assetId}>
                  <span className="asset-tower-name">{assetLabels[level.assetId]}</span>
                  <div className="asset-tower-rail" aria-hidden="true">
                    <motion.i
                      animate={{ height: `${Math.min(percentage, 100)}%` }}
                      initial={{ height: "0%" }}
                      transition={{ delay: 0.18, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <span className="asset-tower-threshold" />
                  </div>
                  <strong>{percentage}%</strong>
                  {isWorst ? <small>THIS ONE MATTERS</small> : <small>기초자산</small>}
                </article>
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
  onBack,
  onReset,
}: {
  prediction: PredictedOutcome;
  result: CalculationResponse;
  onBack: () => void;
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
  const isVerified = comparison.status === "MATCH";

  return (
    <div className="stage stage-centered stage-wide passport-stage">
      <BackButton onClick={onBack} label="예상 결과 다시 고르기" />
      <section className="understanding-passport">
        <div className="passport-topline"><span>한끗 REPORT</span><span>{result.meta.rulesVersion}</span></div>
        <div className="passport-heading">
          <div>
            <p>STEP-DOWN ELS</p>
            <h1>이번에 확인한 한끗</h1>
          </div>
          <span className={isVerified ? "passport-status is-verified" : "passport-status"}>{isVerified ? "WORST-OF 확인" : "WORST-OF 재확인"}</span>
        </div>

        <div className="passport-checks">
          <span>핵심 확인 조건 <small>Worst-of · 가장 낮은 {worstAsset} {evaluation.worstLevelDisplay}</small></span>
          <span className={isVerified ? "is-verified" : "is-review"}>예상과 실제 비교 <small>{isVerified ? "같은 결과를 예상했어요" : "결과 차이를 확인했어요"}</small></span>
          <span>손실 발생 조건 <small>{evaluation.worstLevelDisplay} &lt; 80%</small></span>
          <span className="is-out-of-scope">조기상환 · Knock-In <small>이번 MVP 검증 범위 밖</small></span>
        </div>

        <div className="passport-difference">
          <span>발견된 한끗</span>
          <strong><em>평균</em><i>→</i><b>가장 낮은 기초자산</b></strong>
          <p>평균 {averageDisplay}가 아니라 Worst-of {evaluation.worstLevelDisplay}가 실제 결과를 결정했습니다.</p>
        </div>

        <div className="passport-results">
          <div><span>MY PREDICTION</span><strong>{predictionLabels[prediction]}</strong></div>
          <div><span>ACTUAL CONTRACT</span><strong>{resultTitle}</strong><small>원금 100만원 가정 시 {redemptionWon}원 상환 · {evaluation.returnRateDisplay}</small></div>
        </div>

        <div className="next-check-card">
          <span>다음 계약서에서 확인할 한 가지</span>
          <strong>여러 기초자산이면, 평균인지 가장 낮은 값인지부터 확인하세요.</strong>
          <p>수익률보다 먼저 판단 기준과 기준선을 읽는 것이 이번 가상 사례의 핵심입니다.</p>
        </div>

        <div className="passport-footer">
          <p><SparkIcon /> 상품 전체 이해도를 점수로 평가하지 않습니다.</p>
          <button className="restart-button" onClick={onReset} type="button">처음부터 다시 보기 <ArrowIcon /></button>
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
            sourceText={text}
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
            onBack={() => moveTo("SCENARIO")}
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
    <MotionConfig reducedMotion="user">
      <div className="app-frame">
        <Header onReset={reset} />
        <main className="shell main-content">
          <Progress currentStep={step} />
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="stage-frame"
            exit={{ opacity: 0, y: -10, filter: "blur(5px)" }}
            initial={{ opacity: 0, y: 18, filter: "blur(7px)" }}
            key={step}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            {stage}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <div><strong>한끗</strong><span>설명과 이해 사이</span></div>
          <p>본 서비스의 상품과 수치는 이해검증을 위한 가상 사례이며 투자 권유가 아닙니다.</p>
        </div>
      </footer>
      </div>
    </MotionConfig>
  );
}
