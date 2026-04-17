type Props = {
  open: boolean;
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function SignupModal({
  open,
  email,
  password,
  setEmail,
  setPassword,
  onClose,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-3">
      <div className="retro-panel relative flex max-h-[92dvh] w-full max-w-[28rem] flex-col gap-6 overflow-y-auto rounded-t-[28px] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5 text-left sm:max-h-[85vh] sm:rounded-[28px] sm:p-6 sm:text-center">
        <button
          onClick={onClose}
          className="retro-button min-h-[42px] px-4 py-2 text-sm font-semibold"
          style={{ position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 20 }}
        >
          X
        </button>

        <div className="w-full space-y-7 pr-12">
          <div className="text-center">
            <p className="retro-title theme-kicker text-[10px]">SIGN UP</p>
            <h2 className="retro-title theme-heading mt-3 text-base leading-relaxed sm:text-lg">
              회원가입
            </h2>
          </div>

          <div className="space-y-5">
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block h-12 w-full px-4 py-3 text-left text-base sm:text-center"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block h-12 w-full px-4 py-3 text-left text-base sm:text-center"
            />
          </div>
        </div>

        <div className="w-full">
          <button
            onClick={onSubmit}
            className="retro-button-solid ui-action-fit min-h-[48px] px-8 py-3.5 text-base font-semibold"
          >
            회원가입 완료
          </button>
        </div>
      </div>
    </div>
  );
}