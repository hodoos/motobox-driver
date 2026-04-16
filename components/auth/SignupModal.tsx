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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 p-3 backdrop-blur-sm">
      <div className="retro-panel w-[360px] h-[520px] rounded-[28px] p-6 text-center relative flex flex-col justify-between overflow-y-hidden">
        <button
          onClick={onClose}
          className="retro-button px-3 py-2 text-sm font-semibold"
          style={{ position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 20 }}
        >
          X
        </button>

        <div className="mb-5 flex flex-col items-center gap-3 w-full">
          <div>
            <p className="retro-title text-[10px] text-[#6effa6]/60">SIGN UP</p>
            <h2 className="retro-title mt-3 text-sm leading-relaxed text-[#b8ffd2]">
              CREATE ACCOUNT
            </h2>
          </div>
          <div className="w-full flex justify-center mt-6">
            <div className="flex flex-col w-full items-center gap-4">
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block bg-[#09120d] h-12 w-3/4 rounded-2xl border border-[#2a3a2f] px-4 py-3 my-2 text-center text-base outline-none transition focus:border-[#6effa6]/70 focus:ring-2 focus:ring-[#6effa6]/20"
                style={{ marginLeft: 'auto', marginRight: 'auto' }}
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block bg-[#09120d] h-12 w-3/4 rounded-2xl border border-[#2a3a2f] px-4 py-3 my-2 text-center text-base outline-none transition focus:border-[#6effa6]/70 focus:ring-2 focus:ring-[#6effa6]/20"
                style={{ marginLeft: 'auto', marginRight: 'auto' }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-end w-full flex-1">
          <div className="flex justify-center w-full mb-2">
            <button
              onClick={onSubmit}
              className="retro-button-solid px-8 py-3.5 text-base font-semibold"
              style={{ minWidth: '120px', width: 'auto' }}
            >
              회원가입 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}