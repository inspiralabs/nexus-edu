import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Image
            src="/SQA.png"
            alt="Logo SQA"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
          />
          <span className="block text-sm font-medium tracking-tight text-slate-500 dark:text-slate-400">
            NexusEdu - SQA
          </span>
        </div>

        <p className="text-center text-xs text-slate-600 md:text-right">
          ©2026 InspiraLabs · Unggul Sulaiman, S.Kom
        </p>
      </div>
    </footer>
  )
}
