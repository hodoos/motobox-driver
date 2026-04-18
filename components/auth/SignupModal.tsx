"use client";

type Props = {
  open: boolean;
  driverName: string;
  email: string;
  phoneNumber: string;
  password: string;
  passwordConfirm: string;
  setDriverName: (value: string) => void;
  setEmail: (value: string) => void;
  setPhoneNumber: (value: string) => void;
  setPassword: (value: string) => void;
  setPasswordConfirm: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function SignupModal({
  open,
  driverName,
  email,
  phoneNumber,
  password,
  passwordConfirm,
  setDriverName,
  setEmail,
  setPhoneNumber,
  setPassword,
  setPasswordConfirm,
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
              type="text"
              placeholder="이름"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              autoComplete="name"
              className="block h-12 w-full px-4 py-3 text-left text-base sm:text-center"
            />
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="block h-12 w-full px-4 py-3 text-left text-base sm:text-center"
            />
            <input
              type="tel"
              placeholder="휴대폰번호"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              autoComplete="tel"
              className="block h-12 w-full px-4 py-3 text-left text-base sm:text-center"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="block h-12 w-full px-4 py-3 text-left text-base sm:text-center"
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
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