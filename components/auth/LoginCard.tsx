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
    <div className="mx-auto w-full max-w-[20rem]">
      <div className="relative retro-panel min-h-[180px] overflow-hidden rounded-[28px] px-5 py-10 sm:min-h-[180px] sm:rounded-[32px] sm:px-7 sm:py-11">
        <div className="absolute right-4 top-4 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-10 left-8 h-24 w-24 rounded-full bg-white/6 blur-3xl" />
        <div className="relative z-10 text-center">
          <p className="theme-copy mx-auto max-w-[240px] text-sm leading-relaxed sm:max-w-[280px] sm:text-[15px]">
            택배 종사자 매출 기록 시스템
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center sm:mt-10">
          <div className="flex w-full flex-col items-center py-3 sm:py-4">
            <div className="w-full max-w-[14.5rem] sm:max-w-[14.5rem]">
              <div>
                <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block h-14 w-full px-5 py-4 text-center text-base sm:h-16 sm:px-6 sm:text-lg"
                />
              </div>
            </div>

            <div
              className="w-full max-w-[14.5rem] sm:max-w-[14.5rem]"
              style={{ marginTop: "18px", marginBottom: "14px" }}
            >
              <div>
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block h-14 w-full px-5 py-4 text-center text-base sm:h-16 sm:px-6 sm:text-lg"
                />
              </div>
            </div>
          </div>

          <div
            className="mt-7 flex w-full items-center justify-center sm:mt-8"
            style={{ columnGap: "14px", marginBottom: "16px" }}
          >
            <button
              onClick={onLogin}
              className="retro-button-solid min-h-[42px] whitespace-nowrap px-2.5 text-[15px] font-semibold"
            >
              로그인
            </button>

            <button
              onClick={onOpenSignup}
              className="retro-button min-h-[42px] whitespace-nowrap px-2.5 text-[15px] font-semibold"
            >
              회원가입
            </button>
          </div>
        </div>
      </div>

      <p className="theme-kicker mt-4 text-center text-[10px] sm:text-[11px]">
        support : motoboxx@naver.com
      </p>
    </div>
  );
}