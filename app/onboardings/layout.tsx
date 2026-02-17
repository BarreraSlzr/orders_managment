import { Fraunces } from "next/font/google";

const onboardingFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-onboarding",
});

export default function OnboardingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${onboardingFont.variable} min-h-screen bg-slate-50`}>
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-200/40 via-rose-200/40 to-sky-200/40 blur-3xl" />
          <div className="absolute bottom-0 right-[-8rem] h-56 w-56 rounded-full bg-gradient-to-br from-emerald-200/40 via-lime-200/30 to-teal-200/40 blur-2xl" />
        </div>
        <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-12">
          {children}
        </div>
      </div>
    </div>
  );
}
