import { ShieldAlert } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white">
            <ShieldAlert className="w-[20px] h-[20px]" />
          </div>
          <span className="font-extrabold text-[17px] tracking-tight">Sigap Buronan</span>
        </div>
        <div className="bento-cell shadow-card">{children}</div>
      </div>
    </div>
  );
}
