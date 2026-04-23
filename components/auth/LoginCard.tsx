import { KAKAO_INQUIRY_URL } from "../../lib/support";
import { triggerLandingRipple } from "../../lib/landingRipple";

type Props = {
  identifier: string;
  password: string;
  rememberCredentials: boolean;
  setIdentifier: (value: string) => void;
  setPassword: (value: string) => void;
  onRememberCredentialsChange: (checked: boolean) => void;
  onLogin: () => void;
  onOpenSignup: () => void;
};

export default function LoginCard({
  identifier,
  password,
  rememberCredentials,
  setIdentifier,
  setPassword,
  onRememberCredentialsChange,
  onLogin,
  onOpenSignup,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onLogin();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[18.5rem] flex-col items-center gap-9 sm:max-w-[19rem]">
      <div className="landing-panel-fx relative flex w-full flex-col overflow-hidden rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-5 sm:py-6 retro-panel">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(139,148,255,0.42)] to-transparent" />
        <div className="absolute -right-8 top-5 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.26),transparent_70%)] blur-2xl" />
        <div className="absolute -left-7 bottom-10 h-20 w-20 rounded-full bg-[radial-gradient(circle,rgba(255,149,0,0.18),transparent_72%)] blur-2xl" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="landing-badge-fx theme-kicker inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] leading-none">
              DRIVER LOGIN
            </span>
            <h1 className="theme-heading text-[1.9rem] font-black tracking-[-0.05em] sm:text-[2.1rem]">
              택배판
            </h1>
            <p className="theme-copy max-w-[10.5rem] text-[11px] leading-relaxed">
              매출 기록 시스템
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-[13.5rem] flex-col gap-3">
            <input
              type="text"
              placeholder="아이디"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="username"
              className="landing-input-fx block h-10 w-full rounded-[15px] border border-[var(--border)] bg-[rgba(10,11,18,0.86)] px-3.5 text-left text-sm text-[var(--text-strong)] placeholder:text-[var(--text-dim)] transition-all focus:border-[var(--border-strong)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] focus:outline-none"
            />

            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
              className="landing-input-fx block h-10 w-full rounded-[15px] border border-[var(--border)] bg-[rgba(10,11,18,0.86)] px-3.5 text-left text-sm text-[var(--text-strong)] placeholder:text-[var(--text-dim)] transition-all focus:border-[var(--border-strong)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] focus:outline-none"
            />

            <div className="flex items-center justify-center">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={rememberCredentials}
                  onChange={(event) => onRememberCredentialsChange(event.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-indigo-500"
                />
                <span>로그인 정보 저장</span>
              </label>
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-[13.5rem] grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onLogin}
              onPointerDown={triggerLandingRipple}
              className="landing-button-fx landing-button-fx--solid retro-button-solid min-h-[42px] rounded-full px-4 text-sm font-semibold transition-all hover:translate-y-[-1px] hover:shadow-lg active:scale-[0.98]"
            >
              로그인
            </button>

            <button
              type="button"
              onClick={onOpenSignup}
              onPointerDown={triggerLandingRipple}
              className="landing-button-fx landing-button-fx--secondary retro-button min-h-[42px] rounded-full px-4 text-sm font-semibold transition-all hover:translate-y-[-1px] active:scale-[0.98]"
            >
              회원가입
            </button>
          </div>
        </div>
      </div>

      <div className="landing-panel-fx landing-panel-fx--support theme-note-box flex w-full max-w-[15.25rem] flex-col items-center gap-2.5 rounded-[18px] px-3.5 py-3 text-center shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        <p className="theme-kicker text-[10px]">SUPPORT</p>
        <a
          href={KAKAO_INQUIRY_URL}
          target="_blank"
          rel="noreferrer"
          onPointerDown={triggerLandingRipple}
          className="landing-button-fx landing-button-fx--solid landing-button-fx--support retro-button-solid inline-flex min-h-[40px] items-center justify-center rounded-full px-4.5 py-2 text-[13px] font-semibold transition-all hover:translate-y-[-1px] active:scale-[0.99]"
          aria-label="카카오톡 문의하기"
        >
          카카오톡 문의하기
        </a>

        <p className="theme-copy text-[10.5px] leading-relaxed">
          카카오톡 상담으로 연결됩니다
        </p>
      </div>
    </div>
  );
}
