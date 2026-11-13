import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { COLUNAS_OBRIGATORIAS, normalizarCabecalho, validarLinhas, type ResultadoImportacao } from "@/lib/importacao";
import { formatarData } from "@/lib/datas";

function decodificar(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

async function lerArquivo(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const texto = decodificar(buf).replace(/^\uFEFF/, "");
    const r = Papa.parse<Record<string, string>>(texto, { header: true, skipEmptyLines: "greedy" });
    return r.data;
  }
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: "" });
  // Datas e horários do Excel chegam como números seriais: converter para DD/MM/AAAA e HH:MM.
  return linhas.map((l) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(l)) {
      const c = normalizarCabecalho(k);
      if (typeof v === "number" && (c === "data" || c === "horario")) {
        const d = XLSX.SSF.parse_date_code(v);
        out[k] = c === "data" ? `${pad(d.d)}/${pad(d.m)}/${d.y}` : `${pad(d.H)}:${pad(d.M)}`;
      } else out[k] = v;
    }
    return out;
  });
}

export function ImportarAulas({ onConcluido }: { onConcluido: () => void }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function escolher(file: File | undefined) {
    if (!file) return;
    setArquivo(file.name);
    setResultado(null);
    setErroLeitura(null);
    setLendo(true);
    try {
      const linhas = await lerArquivo(file);
      if (linhas.length === 0) setErroLeitura("A planilha está vazia.");
      else setResultado(validarLinhas(linhas));
    } catch {
      setErroLeitura("Não conseguimos ler esse arquivo. Envie um CSV ou XLSX.");
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importar() {
    if (!resultado?.validas.length) return;
    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      for (let i = 0; i < resultado.validas.length; i += 500) {
        const lote = resultado.validas.slice(i, i + 500).map((a) => ({ ...a, updated_at: agora }));
        const { error } = await supabase
          .from("aulas")
          .upsert(lote, { onConflict: "curso,unidade,tema_da_aula,data,horario,professor" });
        if (error) throw error;
      }
      toast.success(`${resultado.validas.length} aulas importadas/atualizadas.`);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      setResultado(null);
      setArquivo(null);
      onConcluido();
    } catch {
      toast.error("Não foi possível salvar as aulas. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-dashed border-input bg-card p-6 text-center">
        <FileSpreadsheet className="mx-auto size-10 text-brand-vibrant" aria-hidden />
        <p className="mt-3 font-bold">Envie a planilha de aulas (CSV ou XLSX)</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Colunas: {COLUNAS_OBRIGATORIAS.join(", ")}. Data em DD/MM/AAAA e horário em HH:MM. Aulas que já existem têm as
          vagas atualizadas.
        </p>
        <label htmlFor="arquivo-aulas" className="sr-only">
          Arquivo de aulas
        </label>
        <input
          ref={inputRef}
          id="arquivo-aulas"
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => escolher(e.target.files?.[0])}
        />
        <Button variant="soft" className="mt-4" onClick={() => inputRef.current?.click()} disabled={lendo}>
          {lendo ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {lendo ? "Lendo arquivo…" : "Escolher arquivo"}
        </Button>
        {arquivo && <p className="mt-2 text-xs text-muted-foreground">{arquivo}</p>}
      </div>

      {erroLeitura && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {erroLeitura}
        </p>
      )}

      {resultado && resultado.colunasFaltando.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-highlight bg-card p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-cta" aria-hidden />
          <p>
            Colunas faltando: <strong>{resultado.colunasFaltando.join(", ")}</strong>. Ajuste o cabeçalho e envie de novo.
          </p>
        </div>
      )}

      {resultado && resultado.colunasFaltando.length === 0 && (
        <>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-bold text-brand">
              <CheckCircle2 className="size-4" aria-hidden /> {resultado.validas.length} linhas prontas
            </span>
            {resultado.invalidas.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-highlight px-3 py-1.5 text-sm font-bold text-highlight-foreground">
                <AlertTriangle className="size-4" aria-hidden /> {resultado.invalidas.length} com erro (serão ignoradas)
              </span>
            )}
          </div>

          {resultado.invalidas.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="font-bold">Linhas com erro</p>
              <ul className="mt-2 grid max-h-56 gap-1.5 overflow-auto text-sm">
                {resultado.invalidas.map((l) => (
                  <li key={l.linha}>
                    <span className="font-medium">Linha {l.linha}:</span>{" "}
                    <span className="text-muted-foreground">{l.erros.join("; ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.validas.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <p className="border-b border-border px-4 py-3 font-bold">Pré-visualização</p>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {["Curso", "Unidade", "Tema", "Data", "Horário", "Professor", "Vagas"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.validas.slice(0, 100).map((a, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">{a.curso}</td>
                        <td className="px-3 py-2">{a.unidade}</td>
                        <td className="px-3 py-2">{a.tema_da_aula}</td>
                        <td className="px-3 py-2">{formatarData(a.data)}</td>
                        <td className="px-3 py-2">{a.horario}</td>
                        <td className="px-3 py-2">{a.professor}</td>
                        <td className="px-3 py-2">{a.vagas_totais}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resultado.validas.length > 100 && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  Mostrando 100 de {resultado.validas.length} linhas.
                </p>
              )}
            </div>
          )}

          <Button size="lg" onClick={importar} disabled={salvando || resultado.validas.length === 0} className="justify-self-start">
            {salvando && <Loader2 className="animate-spin" aria-hidden />}
            Importar {resultado.validas.length} aulas
          </Button>
        </>
      )}
    </div>
  );
}
