import { cn } from "@/lib/utils";

/**
 * Espaço reservado para o logo oficial da Proz (versão branca sobre o gradiente).
 * Substituir pelo arquivo enviado pela marca mantendo largura mínima de 80px.
 */
export function Logo({ className }: { className?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[80px] items-center text-[1.65rem] font-bold leading-none tracking-tight text-on-brand",
        className,
      )}
      aria-label="Proz Educação"
      role="img"
    >
      proz
      <span className="ml-0.5 inline-block size-2 rounded-full bg-on-brand" aria-hidden />
    </span>
  );
}
