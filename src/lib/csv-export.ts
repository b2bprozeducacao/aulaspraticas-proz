export const COLUNAS_EXPORT = [
  "curso",
  "unidade",
  "tema",
  "data",
  "horário",
  "professor",
  "nome",
  "e-mail",
  "data/hora da inscrição",
] as const;

export type LinhaExport = [string, string, string, string, string, string, string, string, string];

function celula(valor: string): string {
  const v = String(valor ?? "");
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV compatível com Excel: separador ";", UTF-8 com BOM, quebras CRLF. */
export function gerarCsv(linhas: LinhaExport[]): string {
  const corpo = [COLUNAS_EXPORT as readonly string[], ...linhas]
    .map((l) => l.map(celula).join(";"))
    .join("\r\n");
  return "\uFEFF" + corpo + "\r\n";
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
