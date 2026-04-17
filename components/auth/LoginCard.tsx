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
    <div className="mx-auto w-full max-w-[28rem]">
      <div className="relative retro-panel overflow-hidden rounded-[28px] px-5 py-7 sm:rounded-[32px] sm:px-7 sm:py-8 sm:min-h-[520px]">
        <div className="absolute right-4 top-4 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-10 left-8 h-24 w-24 rounded-full bg-white/6 blur-3xl" />
        <div className="relative z-10 text-center">
          <p className="retro-title theme-kicker text-[20px] sm:text-[26px] md:text-[28px]">
            DRIVER REPORT
          </p>

          <h1 className="retro-title theme-heading mt-4 text-[26px] sm:text-[30px] md:text-[32px]">
            LOGIN
          </h1>

          <p className="theme-copy mx-auto mt-3 max-w-[240px] text-sm leading-relaxed sm:max-w-[280px] sm:text-[15px]">
            택배 종사자 매출 기록 시스템
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-5 sm:mt-10 sm:gap-6">
          <div className="w-full">
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

          <div className="w-full">
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

          <div className="mt-4 w-full space-y-4 sm:mt-6">
            <div className="w-full">
              <button
                onClick={onLogin}
                className="retro-button-solid ui-action-fit h-12 px-5 text-base font-semibold"
              >
                로그인
              </button>
            </div>

            <div className="w-full">
              <button
                onClick={onOpenSignup}
                className="retro-button ui-action-fit h-12 px-5 text-base font-semibold"
              >
                회원가입
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="theme-kicker mt-4 text-center text-[10px] sm:text-[11px]">
        support : motoboxx@naver.com
      </p>
    </div>
  );
}