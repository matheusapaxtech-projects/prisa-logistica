import { describe, expect, it } from "vitest";
import {
  agruparPorColuna,
  chaveDfeValida,
  chaveDoLimite,
  colunaAnterior,
  COLUNAS,
  destinosPermitidos,
  filtrarCartoes,
  formularioDaPassagem,
  nivelDoTempo,
  rotuloDe,
  somenteDigitos,
  type Cartao,
  type Nivel,
} from "@/lib/quadro";
import { proximoEstado, textoConexao, type EstadoConexao } from "@/lib/conexao";

/** Chave fictícia: 43 dígitos com o modelo nas posições 21-22 e o dígito verificador módulo 11 (mesma conta do banco). */
function montarChave(modelo: string): string {
  const base = ("35" + "2610" + "11222333000181" + modelo).padEnd(43, "1");
  let soma = 0;
  for (let i = 0; i < 43; i++) soma += Number(base[i]) * (2 + ((42 - i) % 8));
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return base + String(dv);
}
const CHAVE_57_VALIDA = montarChave("57");
const CHAVE_58_VALIDA = montarChave("58");
function trocarUltimoDigito(chave: string): string {
  const ultimo = Number(chave.at(-1));
  return chave.slice(0, -1) + String((ultimo + 1) % 10);
}

let seq = 0;
function cartao(extra: Partial<Cartao> = {}): Cartao {
  seq += 1;
  return {
    viagem_id: `v${seq}`,
    numero: seq,
    status_campo: "transito",
    status_desde: "2026-10-23T12:00:00Z",
    cavalo_placa: `TST${String(seq).padStart(4, "0")}`,
    motorista_nome: "Motorista",
    cliente_nome: "Cliente",
    origem_cidade: null,
    origem_uf: null,
    destino_cidade: null,
    destino_uf: null,
    unidade_operacional_id: 1,
    iniciada_por: "u1",
    pausa_tipo: null,
    pausa_programada: null,
    pausa_inicio: null,
    tem_chaves: false,
    pagamento_saida: false,
    tem_canhoto: false,
    divergencia: null,
    ocorrencias_abertas: 0,
    ...extra,
  };
}

describe("colunas", () => {
  it("tem as 10 colunas, na ordem, com os rótulos do usuário", () => {
    expect(COLUNAS.map((c) => c.rotulo)).toEqual([
      "Trânsito", "Aguardando carregamento", "Em carregamento", "Aguardando NF e pagamento", "Em rota",
      "Pausa", "Aguardando descarga", "Aguardando contagem de divergência",
      "Resolução de divergência na carga", "Frete finalizado",
    ]);
  });

  it("marca como estreitáveis só as quatro colunas de espera", () => {
    expect(COLUNAS.filter((c) => c.espera).map((c) => c.status)).toEqual([
      "aguardando_carregamento", "aguardando_nf_pagamento", "aguardando_descarga", "aguardando_contagem",
    ]);
  });

  it("rotuloDe: null é Planejada", () => {
    expect(rotuloDe(null)).toBe("Planejada");
    expect(rotuloDe("em_rota")).toBe("Em rota");
  });
});

describe("passagens", () => {
  it("destinosPermitidos espelha mover_viagem, sem as voltas", () => {
    expect(destinosPermitidos("transito")).toEqual(["aguardando_carregamento", "pausa"]);
    expect(destinosPermitidos("aguardando_carregamento")).toEqual(["em_carregamento"]);
    expect(destinosPermitidos("em_carregamento")).toEqual(["aguardando_nf_pagamento"]);
    expect(destinosPermitidos("aguardando_nf_pagamento")).toEqual(["em_rota"]);
    expect(destinosPermitidos("em_rota")).toEqual(["pausa", "aguardando_descarga"]);
    expect(destinosPermitidos("aguardando_descarga")).toEqual(["aguardando_contagem"]);
    expect(destinosPermitidos("aguardando_contagem")).toEqual(["resolucao_divergencia", "frete_finalizado"]);
    expect(destinosPermitidos("resolucao_divergencia")).toEqual(["frete_finalizado"]);
    expect(destinosPermitidos("frete_finalizado")).toEqual([]);
  });

  it("pausa só volta para a coluna de origem", () => {
    expect(destinosPermitidos("pausa", "transito")).toEqual(["transito"]);
    expect(destinosPermitidos("pausa", "em_rota")).toEqual(["em_rota"]);
    expect(destinosPermitidos("pausa")).toEqual([]);
  });

  it("colunaAnterior só existe para as três voltas permitidas", () => {
    expect(colunaAnterior("aguardando_carregamento")).toBe("transito");
    expect(colunaAnterior("em_carregamento")).toBe("aguardando_carregamento");
    expect(colunaAnterior("aguardando_nf_pagamento")).toBe("em_carregamento");
    expect(colunaAnterior("em_rota")).toBeNull();
    expect(colunaAnterior("transito")).toBeNull();
    expect(colunaAnterior("pausa")).toBeNull();
    expect(colunaAnterior("frete_finalizado")).toBeNull();
  });

  it("formularioDaPassagem diz que dado a passagem pede", () => {
    expect(formularioDaPassagem("aguardando_nf_pagamento", "em_rota")).toBe("documentos");
    expect(formularioDaPassagem("transito", "aguardando_carregamento")).toBeNull();
    expect(formularioDaPassagem("aguardando_carregamento", "em_carregamento")).toBeNull();
    expect(formularioDaPassagem("em_carregamento", "aguardando_nf_pagamento")).toBe("peso_saida");
    expect(formularioDaPassagem("transito", "pausa")).toBe("pausa");
    expect(formularioDaPassagem("em_rota", "pausa")).toBe("pausa");
    expect(formularioDaPassagem("pausa", "em_rota")).toBeNull();
    expect(formularioDaPassagem("em_rota", "aguardando_descarga")).toBeNull();
    expect(formularioDaPassagem("aguardando_descarga", "aguardando_contagem")).toBe("chegada");
    expect(formularioDaPassagem("aguardando_contagem", "frete_finalizado")).toBe("contagem");
    expect(formularioDaPassagem("aguardando_contagem", "resolucao_divergencia")).toBe("contagem");
    expect(formularioDaPassagem("resolucao_divergencia", "frete_finalizado")).toBe("resolucao");
  });

  it("voltar uma coluna pede o motivo", () => {
    expect(formularioDaPassagem("aguardando_carregamento", "transito")).toBe("motivo");
    expect(formularioDaPassagem("em_carregamento", "aguardando_carregamento")).toBe("motivo");
    expect(formularioDaPassagem("aguardando_nf_pagamento", "em_carregamento")).toBe("motivo");
  });
});

describe("tempo-limite", () => {
  const limite = { minutos_ambar: 120, minutos_vermelho: 240 };

  it("nivelDoTempo troca de cor exatamente no limite", () => {
    expect(nivelDoTempo(119, limite)).toBe("normal");
    expect(nivelDoTempo(120, limite)).toBe("ambar");
    expect(nivelDoTempo(239, limite)).toBe("ambar");
    expect(nivelDoTempo(240, limite)).toBe("vermelho");
  });

  it("coluna sem limite (ou limite sem minutos) nunca muda de cor", () => {
    expect(nivelDoTempo(9999, undefined)).toBe("normal");
    expect(nivelDoTempo(9999, { minutos_ambar: null, minutos_vermelho: null })).toBe("normal");
    expect(nivelDoTempo(300, { minutos_ambar: null, minutos_vermelho: 240 })).toBe("vermelho");
    expect(nivelDoTempo(300, { minutos_ambar: 120, minutos_vermelho: null })).toBe("ambar");
  });

  it("chaveDoLimite: pausa usa programada/não programada, o resto o próprio status", () => {
    expect(chaveDoLimite({ status_campo: "pausa", pausa_programada: true })).toBe("pausa_programada");
    expect(chaveDoLimite({ status_campo: "pausa", pausa_programada: false })).toBe("pausa_nao_programada");
    expect(chaveDoLimite({ status_campo: "em_carregamento", pausa_programada: null })).toBe("em_carregamento");
  });
});

describe("chave do CT-e / MDF-e", () => {
  it("somenteDigitos tira espaços e pontos", () => {
    expect(somenteDigitos("3523 1122.3330-0181")).toBe("3523112233300181");
  });

  it("aceita chave válida, com ou sem espaços e pontos", () => {
    expect(chaveDfeValida(CHAVE_57_VALIDA, "57")).toBe(true);
    expect(chaveDfeValida(CHAVE_57_VALIDA.replace(/(\d{4})/g, "$1 "), "57")).toBe(true);
    expect(chaveDfeValida(CHAVE_57_VALIDA.replace(/(\d{4})/g, "$1."), "57")).toBe(true);
    expect(chaveDfeValida(CHAVE_58_VALIDA, "58")).toBe(true);
  });

  it("recusa modelo errado, dígito trocado e tamanho errado", () => {
    expect(chaveDfeValida(CHAVE_57_VALIDA, "58")).toBe(false);
    expect(chaveDfeValida(CHAVE_58_VALIDA, "57")).toBe(false);
    expect(chaveDfeValida(trocarUltimoDigito(CHAVE_57_VALIDA), "57")).toBe(false);
    expect(chaveDfeValida(CHAVE_57_VALIDA.slice(1), "57")).toBe(false);
    expect(chaveDfeValida(CHAVE_57_VALIDA + "0", "57")).toBe(false);
    expect(chaveDfeValida("", "57")).toBe(false);
  });
});

describe("filtrarCartoes", () => {
  it("soProblema devolve vermelho/âmbar, pausa não programada, divergência e ocorrência aberta", () => {
    const normal = cartao();
    const vermelho = cartao({ status_campo: "em_carregamento" });
    const ambar = cartao({ status_campo: "aguardando_descarga" });
    const pausaNaoProg = cartao({ status_campo: "pausa", pausa_programada: false });
    const pausaProg = cartao({ status_campo: "pausa", pausa_programada: true });
    const divergente = cartao({ status_campo: "resolucao_divergencia", divergencia: "falta" });
    const semDiv = cartao({ status_campo: "frete_finalizado", divergencia: "sem_divergencia" });
    const ocorrencia = cartao({ ocorrencias_abertas: 2 });
    const niveis = new Map<number, Nivel>([
      [vermelho.numero!, "vermelho"],
      [ambar.numero!, "ambar"],
    ]);
    const nivelDe = (c: Cartao): Nivel => niveis.get(c.numero ?? 0) ?? "normal";
    const r = filtrarCartoes(
      [normal, vermelho, ambar, pausaNaoProg, pausaProg, divergente, semDiv, ocorrencia],
      { soProblema: true },
      nivelDe,
    );
    expect(r).toEqual([vermelho, ambar, pausaNaoProg, divergente, ocorrencia]);
  });

  it("filtra por cliente, motorista, unidade e minhas", () => {
    const a = cartao({ cliente_nome: "ACME", motorista_nome: "João", unidade_operacional_id: 1, iniciada_por: "u1" });
    const b = cartao({ cliente_nome: "Beta", motorista_nome: "Maria", unidade_operacional_id: 2, iniciada_por: "u2" });
    const sempre = (): Nivel => "normal";
    expect(filtrarCartoes([a, b], {}, sempre)).toEqual([a, b]);
    expect(filtrarCartoes([a, b], { cliente: "Beta" }, sempre)).toEqual([b]);
    expect(filtrarCartoes([a, b], { motorista: "João" }, sempre)).toEqual([a]);
    expect(filtrarCartoes([a, b], { unidade: 2 }, sempre)).toEqual([b]);
    expect(filtrarCartoes([a, b], { minhasDe: "u1" }, sempre)).toEqual([a]);
    expect(filtrarCartoes([a, b], { cliente: "ACME", unidade: 2 }, sempre)).toEqual([]);
  });
});

describe("agruparPorColuna", () => {
  it("devolve as 10 colunas, cada uma com o mais antigo primeiro", () => {
    const novo = cartao({ status_campo: "em_rota", status_desde: "2026-10-23T15:00:00Z" });
    const antigo = cartao({ status_campo: "em_rota", status_desde: "2026-10-23T09:00:00Z" });
    const meio = cartao({ status_campo: "em_rota", status_desde: "2026-10-23T12:00:00Z" });
    const outro = cartao({ status_campo: "transito" });
    const planejada = cartao({ status_campo: null });
    const g = agruparPorColuna([novo, antigo, meio, outro, planejada]);
    expect(Object.keys(g)).toHaveLength(10);
    expect(g.em_rota).toEqual([antigo, meio, novo]);
    expect(g.transito).toEqual([outro]);
    expect(g.pausa).toEqual([]);
  });
});

describe("estado da conexão", () => {
  const as1432 = new Date("2026-10-23T17:32:00Z"); // 14:32 em Brasília
  const as1500 = new Date("2026-10-23T18:00:00Z");

  it("começa conectando; inscrito sozinho não vira ao vivo, só depois de recarregar", () => {
    const inicio: EstadoConexao = { tipo: "conectando" };
    expect(textoConexao(inicio)).toBe("Conectando…");
    const inscrito = proximoEstado(inicio, { tipo: "inscrito", em: as1432 });
    expect(inscrito.tipo).toBe("conectando");
    expect(textoConexao(inscrito)).toBe("Conectando…");
    const vivo = proximoEstado(inscrito, { tipo: "recarregou", em: as1432 });
    expect(vivo).toEqual({ tipo: "ao_vivo", atualizadoEm: as1432 });
    expect(textoConexao(vivo)).toBe("Ao vivo");
  });

  it("conectando + recarregou (sem inscrito) continua conectando", () => {
    const e = proximoEstado({ tipo: "conectando" }, { tipo: "recarregou", em: as1432 });
    expect(e).toEqual({ tipo: "conectando" });
    expect(textoConexao(e)).toBe("Conectando…");
  });

  it("conectando + inscrito + recarregou vira ao vivo", () => {
    const inscrito = proximoEstado({ tipo: "conectando" }, { tipo: "inscrito", em: as1432 });
    expect(proximoEstado(inscrito, { tipo: "recarregou", em: as1500 })).toEqual({
      tipo: "ao_vivo",
      atualizadoEm: as1500,
    });
  });

  it("erro ou queda ao vivo vira desatualizado desde a última atualização", () => {
    const vivo: EstadoConexao = { tipo: "ao_vivo", atualizadoEm: as1432 };
    const e = proximoEstado(vivo, { tipo: "erro", em: as1500 });
    expect(e).toEqual({ tipo: "desatualizado", desde: as1432, inscrito: false });
    expect(textoConexao(e)).toBe("Desatualizado desde 14:32");
    expect(proximoEstado(vivo, { tipo: "fechado", em: as1500 })).toEqual({
      tipo: "desatualizado",
      desde: as1432,
      inscrito: false,
    });
  });

  it("desatualizado + recarregou (sem inscrito) continua desatualizado desde 14:32", () => {
    // ex.: recarga ao focar a janela com o canal ainda fora do ar
    const des: EstadoConexao = { tipo: "desatualizado", desde: as1432, inscrito: false };
    const e = proximoEstado(des, { tipo: "recarregou", em: as1500 });
    expect(e).toEqual(des);
    expect(textoConexao(e)).toBe("Desatualizado desde 14:32");
  });

  it("desatualizado + inscrito não vira ao vivo; + recarregou vira", () => {
    const des: EstadoConexao = { tipo: "desatualizado", desde: as1432, inscrito: false };
    const inscrito = proximoEstado(des, { tipo: "inscrito", em: as1500 });
    expect(inscrito).toEqual({ tipo: "desatualizado", desde: as1432, inscrito: true });
    expect(textoConexao(inscrito)).toBe("Desatualizado desde 14:32");
    expect(proximoEstado(inscrito, { tipo: "recarregou", em: as1500 })).toEqual({
      tipo: "ao_vivo",
      atualizadoEm: as1500,
    });
  });

  it("erro ou queda desatualizado mantém o desde e derruba o inscrito", () => {
    const des: EstadoConexao = { tipo: "desatualizado", desde: as1432, inscrito: true };
    const esperado = { tipo: "desatualizado", desde: as1432, inscrito: false };
    expect(proximoEstado(des, { tipo: "erro", em: as1500 })).toEqual(esperado);
    expect(proximoEstado(des, { tipo: "fechado", em: as1500 })).toEqual(esperado);
    // e sem o canal, recarregar de novo não volta ao vivo
    expect(proximoEstado(proximoEstado(des, { tipo: "erro", em: as1500 }), { tipo: "recarregou", em: as1500 })).toEqual(
      esperado,
    );
  });

  it("falha ainda conectando vira desatualizado desde o momento do erro", () => {
    const inscrito = proximoEstado({ tipo: "conectando" }, { tipo: "inscrito", em: as1432 });
    expect(proximoEstado(inscrito, { tipo: "erro", em: as1500 })).toEqual({
      tipo: "desatualizado",
      desde: as1500,
      inscrito: false,
    });
  });

  it("ao vivo + recarregou renova o horário; ao vivo + inscrito não muda", () => {
    const vivo: EstadoConexao = { tipo: "ao_vivo", atualizadoEm: as1432 };
    expect(proximoEstado(vivo, { tipo: "recarregou", em: as1500 })).toEqual({ tipo: "ao_vivo", atualizadoEm: as1500 });
    expect(proximoEstado(vivo, { tipo: "inscrito", em: as1500 })).toEqual(vivo);
  });
});
