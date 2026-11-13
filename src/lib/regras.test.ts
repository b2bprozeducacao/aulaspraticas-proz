import { describe, expect, it } from "vitest";
import { emailValido, nomeCompletoValido, normalizarEmail } from "./validacao";
import { gerarCsv } from "./csv-export";
import { validarLinhas } from "./importacao";
import { parseDataBR } from "./datas";

describe("regras do aluno", () => {
  it("salva o e-mail em minúsculas e sem espaços", () => {
    expect(normalizarEmail("  Ana.Silva @Proz.COM ")).toBe("ana.silva@proz.com");
  });

  it("exige nome com pelo menos duas palavras", () => {
    expect(nomeCompletoValido("Ana")).toBe(false);
    expect(nomeCompletoValido("  Ana   Silva ")).toBe(true);
  });

  it("recusa e-mail sem domínio válido", () => {
    expect(emailValido("ana@proz")).toBe(false);
    expect(emailValido("ana@proz.com.br")).toBe(true);
  });
});

describe("exportação CSV", () => {
  it("usa BOM UTF-8 e separador ponto e vírgula", () => {
    const csv = gerarCsv([["Enfermagem", "Centro", "Curativos", "25/11/2026", "10:00", "Rita", "Ana Silva", "ana@x.com", "13/11/2026 17:00"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[0]).toBe("\uFEFFcurso;unidade;tema;data;horário;professor;nome;e-mail;data/hora da inscrição");
    expect(csv.split("\r\n")[1]).toBe("Enfermagem;Centro;Curativos;25/11/2026;10:00;Rita;Ana Silva;ana@x.com;13/11/2026 17:00");
  });
});

describe("importação de aulas", () => {
  it("lê data no formato DD/MM/AAAA e recusa datas impossíveis", () => {
    expect(parseDataBR("25/11/2026")).toBe("2026-11-25");
    expect(parseDataBR("31/02/2026")).toBeNull();
  });

  it("aponta coluna faltando", () => {
    const r = validarLinhas([{ curso: "A", unidade: "B", tema_da_aula: "C", data: "01/12/2026", horario: "10:00", professor: "P" }]);
    expect(r.colunasFaltando).toEqual(["vagas_totais"]);
  });

  it("separa linhas com vagas não numéricas ou data inválida", () => {
    const base = { Curso: "A", Unidade: "B", "Tema da aula": "C", Horário: "10:00", Professor: "P" };
    const r = validarLinhas([
      { ...base, Data: "01/12/2026", "Vagas totais": "8" },
      { ...base, Data: "2026-12-01", "Vagas totais": "8" },
      { ...base, Data: "02/12/2026", "Vagas totais": "oito" },
    ]);
    expect(r.validas).toHaveLength(1);
    expect(r.validas[0]).toMatchObject({ data: "2026-12-01", horario: "10:00", vagas_totais: 8 });
    expect(r.invalidas.map((l) => l.linha)).toEqual([3, 4]);
  });
});
