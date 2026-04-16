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
    <div className="w-full max-w-[360px]">
      <div className="retro-panel rounded-[26px] px-5 py-6">
        <div className="text-center">
          <p className="retro-title text-[9px] text-[#6effa6]/60">
            DRIVER REPORT
          </p>

          <h1 className="retro-title mt-4 text-[17px] text-[#b8ffd2]">
            LOGIN
          </h1>

          <p className="mt-3 text-[12px] text-[#7dffb1]/62">
            정산 · 휴무 · 매출 관리
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="space-y-1">
            <label className="block text-center text-[11px] font-semibold text-[#9fffc4]">
              이메일
            </label>

            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#09120d] px-4 py-2 text-center text-[13px]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-center text-[11px] font-semibold text-[#9fffc4]">
              비밀번호
            </label>

            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#09120d] px-4 py-2 text-center text-[13px]"
            />
          </div>

          <button
            onClick={onLogin}
            className="retro-button-solid w-full py-2 text-[13px] font-semibold"
          >
            로그인
          </button>

          <button
            onClick={onOpenSignup}
            className="retro-button w-full py-2 text-[13px] font-semibold"
          >
            회원가입
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] text-[#7dffb1]/55">
        support : motoboxx@naver.com
      </p>
    </div>
  );
}