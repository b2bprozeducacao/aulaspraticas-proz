import { CalendarDays, ChevronRight, Clock, GraduationCap, MapPin, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { diaDaSemana, formatarData, formatarHorario } from "@/lib/datas";
import { ULTIMAS_VAGAS, type AulaDisponivel, type ResumoAula } from "./tipos";

export function StepHeading({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string | undefined }) {
  return (
    <div className="mb-6">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1.5 text-[1.75rem] leading-tight sm:text-3xl">{title}</h2>
      {hint && <p className="mt-2 text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function OptionButton({
  label,
  detail,
  onClick,
  icon,
}: {
  label: string;
  detail?: string | undefined;
  onClick: () => void;
  icon?: ReactNode | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-vibrant focus-visible:border-brand-vibrant sm:p-5"
    >
      {icon && (
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-vibrant">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold text-foreground">{label}</span>
        {detail && <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-brand-vibrant transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

export function VagasBadge({ restantes }: { restantes: number }) {
  if (restantes <= 0)
    return <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">Esgotada</span>;
  if (restantes <= ULTIMAS_VAGAS)
    return (
      <span className="rounded-full bg-highlight px-3 py-1 text-xs font-bold text-highlight-foreground">
        Últimas vagas
      </span>
    );
  return null;
}

function capitalizar(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function textoVagas(n: number) {
  if (n <= 0) return "Sem vagas";
  return n === 1 ? "1 vaga restante" : `${n} vagas restantes`;
}

export function AulaCard({ aula, onSelect }: { aula: AulaDisponivel; onSelect: () => void }) {
  const esgotada = aula.vagas_restantes <= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={esgotada}
      aria-disabled={esgotada}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all",
        esgotada
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-0.5 hover:border-brand-vibrant focus-visible:border-brand-vibrant",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-lg font-bold leading-snug text-brand">{aula.tema_da_aula}</span>
        <VagasBadge restantes={aula.vagas_restantes} />
      </div>
      <ul className="grid gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <CalendarDays className="size-4 text-brand-vibrant" aria-hidden />
          <span>
            {capitalizar(diaDaSemana(aula.data))}, {formatarData(aula.data)}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-4 text-brand-vibrant" aria-hidden />
          {formatarHorario(aula.horario)}
        </li>
        <li className="flex items-center gap-2">
          <UserRound className="size-4 text-brand-vibrant" aria-hidden />
          Prof. {aula.professor}
        </li>
      </ul>
      <p className={cn("text-sm font-bold", esgotada ? "text-muted-foreground" : "text-cta")}>
        {textoVagas(aula.vagas_restantes)}
      </p>
    </button>
  );
}

export function ResumoLista({ aula }: { aula: ResumoAula }) {
  const itens: { icon: ReactNode; rotulo: string; valor: string }[] = [
    { icon: <GraduationCap className="size-4" aria-hidden />, rotulo: "Curso", valor: aula.curso },
    { icon: <MapPin className="size-4" aria-hidden />, rotulo: "Unidade", valor: aula.unidade },
    { icon: <CalendarDays className="size-4" aria-hidden />, rotulo: "Data", valor: aula.data },
    { icon: <Clock className="size-4" aria-hidden />, rotulo: "Horário", valor: aula.horario },
    { icon: <UserRound className="size-4" aria-hidden />, rotulo: "Professor(a)", valor: aula.professor },
  ];
  return (
    <div>
      <p className="text-xl font-bold leading-snug text-brand">{aula.tema_da_aula}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-card text-brand-vibrant">
              {i.icon}
            </span>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{i.rotulo}</dt>
              <dd className="font-medium text-foreground">{i.valor}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function paraResumo(a: AulaDisponivel): ResumoAula {
  return {
    curso: a.curso,
    unidade: a.unidade,
    tema_da_aula: a.tema_da_aula,
    data: formatarData(a.data),
    horario: formatarHorario(a.horario),
    professor: a.professor,
  };
}
