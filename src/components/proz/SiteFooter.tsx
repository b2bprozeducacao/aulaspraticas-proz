import { Clock, MessageCircle } from "lucide-react";
import { WHATSAPP_EXIBICAO, WHATSAPP_URL } from "@/lib/contato";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto grid max-w-3xl gap-3 px-5 py-6 text-sm text-muted-foreground sm:grid-cols-2">
        <p className="flex items-start gap-2">
          <Clock className="mt-0.5 size-4 shrink-0 text-brand-vibrant" aria-hidden />
          <span>
            Chegue <strong className="font-medium text-foreground">15 min antes</strong> e apresente-se na secretaria ou ao seu professor(a).
          </span>
        </p>
        <p className="flex items-start gap-2">
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-brand-vibrant" aria-hidden />
          <span>
            Imprevisto? Fale no WhatsApp{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand underline underline-offset-2 hover:text-brand-vibrant"
            >
              {WHATSAPP_EXIBICAO}
            </a>
          </span>
        </p>
      </div>
      <p className="pb-6 text-center text-xs text-subtle">© Proz Educação</p>
    </footer>
  );
}
