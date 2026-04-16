type Props = {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onLogin: () => void;
  onOpenSignup: () => void;
};

export default function LoginCard({
  email,
  password,
  setEmail,
  setPassword,
  onLogin,
  onOpenSignup,
}: Props) {
  return (
    <div className="w-full max-w-[380px] mx-auto">
      <div className="relative retro-panel overflow-hidden rounded-[30px] px-7 py-8 min-h-[520px]">
        <div className="absolute right-5 top-5 h-28 w-28 rounded-full bg-[#6effa6]/20 blur-3xl" />
        <div className="absolute left-6 bottom-8 h-24 w-24 rounded-full bg-[#7dffb1]/15 blur-3xl" />
        <div className="relative z-10 text-center">
          <p className="retro-title text-[9px] text-[#6effa6]/60">
            DRIVER REPORT
          </p>

          <h1 className="retro-title mt-4 text-[18px] text-[#b8ffd2]">
            LOGIN
          </h1>

          <p className="mx-auto mt-3 max-w-[280px] text-[12px] leading-relaxed text-[#7dffb1]/62">
            정산 · 휴무 · 매출 관리 플랫폼에 빠르게 접근하세요.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-10">
          <div className="space-y-3 w-full max-w-[260px]">
            <label className="block text-center text-[11px] font-semibold text-[#9fffc4]">
              이메일
            </label>

            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block bg-[#09120d] h-12 mx-auto w-1/2 rounded-2xl border border-[#2a3a2f] px-4 text-center text-[13px] outline-none transition focus:border-[#6effa6]/70 focus:ring-2 focus:ring-[#6effa6]/20"
            />
          </div>

          <div className="space-y-3 w-full max-w-[260px]">
            <label className="block text-center text-[11px] font-semibold text-[#9fffc4]">
              비밀번호
            </label>

            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block bg-[#09120d] h-12 mx-auto w-1/2 rounded-2xl border border-[#2a3a2f] px-4 text-center text-[13px] outline-none transition focus:border-[#6effa6]/70 focus:ring-2 focus:ring-[#6effa6]/20"
            />
          </div>

          <div className="grid gap-3 w-full max-w-[260px]">
            <button
              onClick={onLogin}
              className="block retro-button-solid mx-auto w-1/2 h-12 rounded-2xl text-[14px] font-semibold"
            >
              로그인
            </button>

            <button
              onClick={onOpenSignup}
              className="block retro-button mx-auto w-1/2 h-12 rounded-2xl text-[14px] font-semibold"
            >
              회원가입
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] text-[#7dffb1]/55">
        support : motoboxx@naver.com
      </p>
    </div>
  );
}