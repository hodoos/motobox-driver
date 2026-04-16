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
    <div className="w-full max-w-md">
      <div className="rounded-[36px] border border-black/8 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.08)] md:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.24em] text-black/40">
            DRIVER REPORT
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-black">
            기사 플랫폼 로그인
          </h1>
          <p className="mt-2 text-sm leading-6 text-black/55">
            로그인 후 정산기간 달력과 업무 리포트를 바로 사용할 수 있습니다.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-black/70">이메일</label>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-black outline-none transition focus:border-black/25 focus:bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black/70">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-black outline-none transition focus:border-black/25 focus:bg-white"
            />
          </div>

          <button
            onClick={onLogin}
            className="w-full rounded-2xl bg-black py-3.5 text-base font-semibold text-white shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px]"
          >
            로그인
          </button>

          <button
            onClick={onOpenSignup}
            className="w-full rounded-2xl border border-black/10 bg-white py-3.5 text-base font-semibold text-black transition hover:bg-black hover:text-white"
          >
            회원가입
          </button>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-black/70">
        support : motoboxx@naver.com
      </p>
    </div>
  );
}