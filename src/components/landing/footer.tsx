function SqaLogo() {
  return (
    <span className="font-bold">
      <span className="text-primary">S</span>
      <span className="text-secondary">Q</span>
      <span className="text-primary">A</span>
    </span>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <SqaLogo />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Sekolah Quran Asy Syahid
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 dark:text-slate-400 md:text-right">
          ©2026 InspiraLabs · Unggul Sulaiman, S.Kom
        </p>
      </div>
    </footer>
  )
}
