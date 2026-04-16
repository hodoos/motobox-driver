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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center md:p-4">
      <div className="retro-panel w-full max-w-md rounded-t-[28px] p-6 md:rounded-[28px]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="retro-title text-[10px] text-[#6effa6]/60">SIGN UP</p>
            <h2 className="retro-title mt-3 text-lg leading-relaxed text-[#b8ffd2]">
              CREATE ACCOUNT
            </h2>
          </div>
          <button
            onClick={onClose}
            className="retro-button px-3 py-2 text-sm font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#9fffc4]">이메일</label>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#09120d] px-4 py-3"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#9fffc4]">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#09120d] px-4 py-3"
            />
          </div>

          <button
            onClick={onSubmit}
            className="retro-button-solid w-full py-3.5 text-base font-semibold"
          >
            회원가입 완료
          </button>
        </div>
      </div>
    </div>
  );
}