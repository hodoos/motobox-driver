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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm md:items-center md:p-4">
      <div className="w-full max-w-md rounded-t-[32px] border border-black/8 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.18)] md:rounded-[32px]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-black/40">
              SIGN UP
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-black">
              회원가입
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-black hover:text-white"
          >
            닫기
          </button>
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
            onClick={onSubmit}
            className="w-full rounded-2xl bg-black py-3.5 text-base font-semibold text-white shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px]"
          >
            회원가입 완료
          </button>
        </div>
      </div>
    </div>
  );
}