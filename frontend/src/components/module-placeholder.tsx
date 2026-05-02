"use client";

type ModulePlaceholderProps = {
  icon: string;
  titleBn: string;
  titleEn: string;
  descBn: string;
  descEn: string;
  phase: "Phase 1" | "Phase 2" | "Phase 3";
  locale: "bn" | "en";
};

const phaseColors: Record<string, string> = {
  "Phase 1": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "Phase 2": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Phase 3": "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export default function ModulePlaceholder({
  icon,
  titleBn,
  titleEn,
  descBn,
  descEn,
  phase,
  locale,
}: ModulePlaceholderProps) {
  const title = locale === "bn" ? titleBn : titleEn;
  const desc = locale === "bn" ? descBn : descEn;
  const comingSoon = locale === "bn" ? "শীঘ্রই আসছে" : "Coming Soon";
  const buildingText =
    locale === "bn"
      ? "এই মডিউলটি তৈরি হচ্ছে। শীঘ্রই ব্যবহারযোগ্য হবে।"
      : "This module is under development and will be available soon.";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="text-6xl">{icon}</div>
      <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-md text-sm text-[var(--muted)] sm:text-base">{desc}</p>

      <div className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${phaseColors[phase]}`}>
        <span className="size-1.5 rounded-full bg-current" />
        {phase} — {comingSoon}
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">{buildingText}</p>
    </div>
  );
}
