import { cn } from "@/lib/utils";
import logo from "@/assets/proz_logo.png.asset.json";

/** Logo oficial da Proz (versão branca sobre o gradiente), largura mínima de 80px. */
export function Logo({ className }: { className?: string | undefined }) {
  return (
    <img
      src={logo.url}
      alt="Proz Educação"
      className={cn("h-8 w-auto min-w-[80px] object-contain", className)}
    />
  );
}
