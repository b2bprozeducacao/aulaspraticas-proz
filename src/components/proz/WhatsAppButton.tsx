import { MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { WHATSAPP_EXIBICAO, WHATSAPP_URL } from "@/lib/contato";

export function WhatsAppButton({ variant = "cta", size = "lg", className }: Pick<ButtonProps, "variant" | "size" | "className">) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label={`Falar no WhatsApp ${WHATSAPP_EXIBICAO}`}>
        <MessageCircle aria-hidden />
        {WHATSAPP_EXIBICAO}
      </a>
    </Button>
  );
}
