import { beforeEach, describe, expect, it, vi } from "vitest";

// Cliente do servidor falso: sessão sempre válida; cada from(tabela) consome a próxima resposta
// enfileirada para a tabela e registra os métodos chamados; rpc é um mock.
type Resposta = { data?: unknown; error?: unknown };
const filas = new Map<string, Resposta[]>();
const consultas: { tabela: string; chamadas: [string, unknown[]][] }[] = [];

function consulta(tabela: string) {
  const r = filas.get(tabela)?.shift() ?? { data: null, error: null };
  const registro = { tabela, chamadas: [] as [string, unknown[]][] };
  consultas.push(registro);
  const q: Record<string, unknown> = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "is", "in", "single", "maybeSingle", "order", "limit"]) {
    q[m] = (...args: unknown[]) => {
      registro.chamadas.push([m, args]);
      return q;
    };
  }
  q.then = (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) =>
    Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(ok, falha);
  return q;
}

const rpc = vi.fn<(nome: string, args: unknown) => Promise<{ data: unknown; error: unknown }>>(async () => ({ data: null, error: null }));
const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-op" } }, error: null })) },
  from: vi.fn((tabela: string) => consulta(tabela)),
  rpc,
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const getPerfil = vi.fn();
vi.mock("@/lib/permissoes", async () => {
  const papeis = await import("@/lib/papeis");
  return { getPerfil: () => getPerfil(), pode: papeis.pode };
});

import {
  cancelarViagem,
  confirmarPagamentoSaida,
  enviarCanhoto,
  iniciarViagem,
  registrarOcorrencia,
  resolverOcorrencia,
} from "@/app/(app)/viagens/actions";
import {
  abaDaViagem,
  AVISO_FINANCEIRO,
  avisaFinanceiro,
  descreverEvento,
  duracao,
  foiAtualizado,
  lerAptidao,
  modoDeInicio,
  podeCancelar,
  podeLiberarComExcecao,
  proximoPasso,
  seloAptidao,
  temCanhotoEnviado,
  type ItemAptidao,
} from "@/app/(app)/viagens/regras";

const VIAGEM = "00000000-0000-4000-8000-000000000501";
const OCORRENCIA = "00000000-0000-4000-8000-000000000601";
const enfileirar = (tabela: string, ...r: Resposta[]) => filas.set(tabela, [...(filas.get(tabela) ?? []), ...r]);
const metodo = (tabela: string, nome: string) =>
  consultas.filter((c) => c.tabela === tabela).flatMap((c) => c.chamadas.filter(([m]) => m === nome).map(([, a]) => a));

beforeEach(() => {
  filas.clear();
  consultas.length = 0;
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  getPerfil.mockReset();
  getPerfil.mockResolvedValue({ userId: "u-op", nome: "Fulano", papel: "operacao", ativo: true });
});

/* ---------- regras puras ---------- */

describe("proximoPasso", () => {
  const v = (status_campo: Parameters<typeof proximoPasso>[0]["status_campo"], pagamento_saida = false, tem_canhoto = false) => ({
    status_campo,
    pagamento_saida,
    tem_canhoto,
  });
  it('Planejada (status nulo) → "Iniciar trânsito"', () => {
    expect(proximoPasso(v(null))).toBe("Iniciar trânsito");
  });
  it('Aguardando NF e pagamento sem pagamento → "Confirmar pagamento de saída"', () => {
    expect(proximoPasso(v("aguardando_nf_pagamento"))).toBe("Confirmar pagamento de saída");
  });
  it('Aguardando NF e pagamento com pagamento → "Informar CT-e, MDF-e, NF-e, CIOT e averbação"', () => {
    expect(proximoPasso(v("aguardando_nf_pagamento", true))).toBe("Informar CT-e, MDF-e, NF-e, CIOT e averbação");
  });
  it("Aguardando carregamento → checklist do veículo; Descarregando sem canhoto → enviar canhoto", () => {
    expect(proximoPasso(v("aguardando_carregamento"))).toBe("Conferir o checklist do veículo");
    expect(proximoPasso(v("descarregando", true))).toBe("Enviar canhoto");
  });
  it("Aguardando saldo: confirmar o saldo; com o saldo pago, encerrar e finalizar", () => {
    expect(proximoPasso({ ...v("aguardando_saldo", true, true), saldo_pago: false })).toBe("Confirmar o pagamento do saldo");
    expect(proximoPasso({ ...v("aguardando_saldo", true, true), saldo_pago: true })).toBe("Encerrar MDF-e e CIOT e finalizar");
  });
  it('Aguardando descarga sem canhoto → "Enviar canhoto"; com canhoto → nada', () => {
    expect(proximoPasso(v("aguardando_descarga"))).toBe("Enviar canhoto");
    expect(proximoPasso(v("aguardando_descarga", true, true))).toBeNull();
  });
  it("outras colunas → null", () => {
    expect(proximoPasso(v("em_rota", true))).toBeNull();
    expect(proximoPasso(v("frete_finalizado", true, true))).toBeNull();
  });
});

describe("temCanhotoEnviado (Ruling R13)", () => {
  it("linha com envio falhou não conta; basta um canhoto com o arquivo no Storage", () => {
    expect(temCanhotoEnviado([])).toBe(false);
    expect(temCanhotoEnviado([{ envioFalhou: true }])).toBe(false);
    expect(temCanhotoEnviado([{ envioFalhou: true }, { envioFalhou: false }])).toBe(true);
  });
  it("com canhoto só com envio falhou, o próximo passo continua sendo enviar o canhoto", () => {
    const tem = temCanhotoEnviado([{ envioFalhou: true }]);
    expect(proximoPasso({ status_campo: "aguardando_descarga", pagamento_saida: true, tem_canhoto: tem })).toBe("Enviar canhoto");
  });
});

const legal: ItemAptidao = { codigo: "cavalo_em_viagem", nivel: "trava_legal", mensagem: 'O cavalo TST1A23 já está na viagem #7, em "Em rota"' };
const trava: ItemAptidao = { codigo: "cnh_vencida", nivel: "trava", mensagem: "CNH do motorista vencida em 01/10/2026" };
const aviso: ItemAptidao = { codigo: "cnh_vencendo", nivel: "aviso", mensagem: "CNH do motorista vence em 30/10/2026" };

describe("podeLiberarComExcecao", () => {
  it("trava_legal → false para todos os papéis, mesmo com trava junto", () => {
    for (const papel of ["admin", "operacao", "financeiro", "leitura"] as const) {
      expect(podeLiberarComExcecao([legal], papel)).toBe(false);
      expect(podeLiberarComExcecao([legal, trava], papel)).toBe(false);
    }
  });
  it("trava → só admin", () => {
    expect(podeLiberarComExcecao([trava, aviso], "admin")).toBe(true);
    expect(podeLiberarComExcecao([trava], "operacao")).toBe(false);
    expect(podeLiberarComExcecao([trava], "financeiro")).toBe(false);
    expect(podeLiberarComExcecao([trava], "leitura")).toBe(false);
    expect(podeLiberarComExcecao([trava], null)).toBe(false);
  });
  it("apta ou só avisos: não há exceção a liberar", () => {
    expect(podeLiberarComExcecao([], "admin")).toBe(false);
    expect(podeLiberarComExcecao([aviso], "admin")).toBe(false);
  });
});

describe("modoDeInicio (botão da ficha)", () => {
  it("apta ou só avisos → iniciar direto", () => {
    expect(modoDeInicio([], "operacao")).toBe("iniciar");
    expect(modoDeInicio([aviso], "operacao")).toBe("iniciar");
  });
  it("trava: admin abre a justificativa; os outros veem o botão desabilitado", () => {
    expect(modoDeInicio([trava], "admin")).toBe("excecao");
    expect(modoDeInicio([trava], "operacao")).toBe("so_admin");
  });
  it("trava_legal: bloqueado para todos", () => {
    expect(modoDeInicio([legal], "admin")).toBe("bloqueado");
    expect(modoDeInicio([trava, legal], "operacao")).toBe("bloqueado");
  });
});

describe("lerAptidao", () => {
  it("lê o jsonb do banco e ignora o que não é linha de aptidão", () => {
    expect(lerAptidao([trava, { codigo: "x" }, 3, null])).toEqual([trava]);
    expect(lerAptidao(null)).toEqual([]);
    expect(lerAptidao("[]")).toEqual([]);
  });
});

describe("seloAptidao (lista de planejadas)", () => {
  it("sem travas nem avisos → Apta", () => {
    expect(seloAptidao({ travas: 0, avisos: 0 })).toEqual({ tipo: "normal", texto: "Apta" });
  });
  it("com travas → N travas (bloqueado)", () => {
    expect(seloAptidao({ travas: 1, avisos: 2 })).toEqual({ tipo: "bloqueado", texto: "1 trava" });
    expect(seloAptidao({ travas: 3, avisos: 0 })).toEqual({ tipo: "bloqueado", texto: "3 travas" });
  });
  it("só avisos → apta com avisos", () => {
    expect(seloAptidao({ travas: 0, avisos: 1 })).toEqual({ tipo: "vencendo", texto: "Apta · 1 aviso" });
    expect(seloAptidao({ travas: 0, avisos: 2 })).toEqual({ tipo: "vencendo", texto: "Apta · 2 avisos" });
  });
});

describe("descreverEvento (linha do tempo)", () => {
  it("início sem exceção", () => {
    expect(descreverEvento({ de: null, para: "transito", motivo: null, dados: { aptidao: [] } })).toEqual({
      titulo: "Viagem iniciada: Trânsito",
      detalhes: [],
    });
  });
  it("início com exceção mostra a justificativa e as travas liberadas", () => {
    expect(descreverEvento({ de: null, para: "transito", motivo: "Motorista renovou, falta subir", dados: { aptidao: [trava, aviso] } })).toEqual({
      titulo: "Viagem iniciada com exceção: Trânsito",
      detalhes: ["Trava liberada: CNH do motorista vencida em 01/10/2026", "Justificativa: Motorista renovou, falta subir"],
    });
  });
  it("pagamento de saída (de = para)", () => {
    expect(descreverEvento({ de: null, para: null, motivo: null, dados: { tipo: "pagamento_saida" } }).titulo).toBe(
      "Adiantamento e vale-pedágio confirmados",
    );
  });
  it("cancelamento", () => {
    expect(descreverEvento({ de: "transito", para: null, motivo: "Cliente adiou", dados: {} })).toEqual({
      titulo: "Viagem cancelada (estava em Trânsito)",
      detalhes: ["Motivo: Cliente adiou"],
    });
  });
  it("passagem com peso de saída e volta com motivo", () => {
    expect(
      descreverEvento({ de: "em_carregamento", para: "aguardando_nf_pagamento", motivo: null, dados: { peso_saida_kg: 37000.5 } }),
    ).toEqual({ titulo: "Em carregamento → Aguardando NF e pagamento", detalhes: ["Peso de saída: 37.000,5 kg"] });
    expect(descreverEvento({ de: "em_carregamento", para: "aguardando_carregamento", motivo: "clique errado", dados: { motivo: "clique errado" } })).toEqual({
      titulo: "Em carregamento → Aguardando carregamento",
      detalhes: ["Motivo: clique errado"],
    });
  });
  it("pausa mostra o tipo e se é programada", () => {
    expect(
      descreverEvento({ de: "em_rota", para: "pausa", motivo: null, dados: { pausa_tipo: "almoco", pausa_programada: true } }).detalhes,
    ).toEqual(["Almoço, programada"]);
  });
});

describe("podeCancelar", () => {
  it("planejada e até Aguardando NF e pagamento; pausa só se saiu de Trânsito", () => {
    expect(podeCancelar(null, null)).toBe(true);
    expect(podeCancelar("transito", null)).toBe(true);
    expect(podeCancelar("aguardando_nf_pagamento", null)).toBe(true);
    expect(podeCancelar("pausa", "transito")).toBe(true);
    expect(podeCancelar("pausa", "em_rota")).toBe(false);
    expect(podeCancelar("em_rota", null)).toBe(false);
    expect(podeCancelar("frete_finalizado", null)).toBe(false);
  });
});

describe("abaDaViagem", () => {
  it("separa planejadas, no quadro, finalizadas e canceladas", () => {
    expect(abaDaViagem({ status_campo: null, cancelada_em: null })).toBe("planejadas");
    expect(abaDaViagem({ status_campo: "em_rota", cancelada_em: null })).toBe("no_quadro");
    expect(abaDaViagem({ status_campo: "frete_finalizado", cancelada_em: null })).toBe("finalizadas");
    expect(abaDaViagem({ status_campo: null, cancelada_em: "2026-10-23T12:00:00Z" })).toBe("canceladas");
  });
});

describe("duracao", () => {
  const agora = new Date("2026-10-23T15:00:00Z");
  it("minutos, horas e dias", () => {
    expect(duracao("2026-10-23T14:59:40Z", agora)).toBe("há menos de 1 min");
    expect(duracao("2026-10-23T14:55:00Z", agora)).toBe("há 5 min");
    expect(duracao("2026-10-23T12:45:00Z", agora)).toBe("há 2 h 15 min");
    expect(duracao("2026-10-23T13:00:00Z", agora)).toBe("há 2 h");
    expect(duracao("2026-10-21T11:00:00Z", agora)).toBe("há 2 dias e 4 h");
  });
});

describe("ocorrências e recusas", () => {
  it("avaria e sinistro pedem aviso ao financeiro", () => {
    expect(AVISO_FINANCEIRO).toBe("Avise o financeiro: pode virar desconto ou prejuízo.");
    expect(avisaFinanceiro("avaria")).toBe(true);
    expect(avisaFinanceiro("sinistro")).toBe(true);
    expect(avisaFinanceiro("atraso")).toBe(false);
  });
  it('recusa por quadro desatualizado é reconhecida pelo trecho "o quadro foi atualizado"', () => {
    expect(foiAtualizado('a viagem já está em "Em rota"; o quadro foi atualizado')).toBe(true);
    expect(foiAtualizado("viagem não apta: CNH vencida")).toBe(false);
  });
});

/* ---------- Server Actions ---------- */

describe("iniciarViagem", () => {
  it("sem justificativa chama iniciar_viagem só com a viagem", async () => {
    await expect(iniciarViagem(VIAGEM)).resolves.toEqual({ ok: true, dados: undefined });
    expect(rpc).toHaveBeenCalledWith("iniciar_viagem", { p_viagem: VIAGEM });
  });
  it("com justificativa manda o texto aparado", async () => {
    await iniciarViagem(VIAGEM, "  CNH renovada, falta subir  ");
    expect(rpc).toHaveBeenCalledWith("iniciar_viagem", { p_viagem: VIAGEM, p_justificativa: "CNH renovada, falta subir" });
  });
  it("a recusa do banco aparece como está", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "viagem não apta: CNH do motorista vencida em 01/10/2026" } });
    await expect(iniciarViagem(VIAGEM)).resolves.toEqual({ ok: false, erro: "viagem não apta: CNH do motorista vencida em 01/10/2026" });
  });
  it("id inválido não chama o banco", async () => {
    await expect(iniciarViagem("x")).resolves.toEqual({ ok: false, erro: "Viagem não encontrada. Atualize a página." });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("cancelarViagem e confirmarPagamentoSaida", () => {
  it("cancelar sem motivo não chama o banco", async () => {
    await expect(cancelarViagem(VIAGEM, "   ")).resolves.toEqual({ ok: false, erro: "Informe o motivo do cancelamento." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("cancelar com motivo chama cancelar_viagem", async () => {
    await expect(cancelarViagem(VIAGEM, " Cliente adiou ")).resolves.toEqual({ ok: true, dados: undefined });
    expect(rpc).toHaveBeenCalledWith("cancelar_viagem", { p_viagem: VIAGEM, p_motivo: "Cliente adiou" });
  });
  it("confirmar pagamento chama confirmar_pagamento_saida", async () => {
    await expect(confirmarPagamentoSaida(VIAGEM)).resolves.toEqual({ ok: true, dados: undefined });
    expect(rpc).toHaveBeenCalledWith("confirmar_pagamento_saida", { p_viagem: VIAGEM });
  });
});

describe("enviarCanhoto", () => {
  it("grava a linha de arquivo CANHOTO (15) da viagem e devolve o caminho viagem/<id>/<arquivo>-<nome>", async () => {
    enfileirar("tipo_arquivo", { data: { aplica_viagem: true } });
    enfileirar("arquivo", { error: null });
    const fd = new FormData();
    fd.set("nome", "Canhoto NF 123.jpg");
    fd.set("mime", "image/jpeg");
    fd.set("tamanho", "250000");
    const r = await enviarCanhoto(VIAGEM, fd);
    expect(r.ok).toBe(true);
    const linha = metodo("arquivo", "insert")[0]?.[0] as Record<string, unknown>;
    expect(linha).toMatchObject({ tipo_arquivo_id: 15, viagem_id: VIAGEM, pessoa_id: null, veiculo_id: null, restrito: false });
    expect(linha.storage_path).toMatch(new RegExp(`^viagem/${VIAGEM}/[0-9a-f-]{36}-canhoto-nf-123\\.jpg$`));
    if (r.ok) expect(r.dados).toBe(linha.storage_path);
  });
  it("arquivo fora dos tipos aceitos não grava nada", async () => {
    const fd = new FormData();
    fd.set("nome", "canhoto.docx");
    fd.set("mime", "application/msword");
    fd.set("tamanho", "1000");
    const r = await enviarCanhoto(VIAGEM, fd);
    expect(r.ok).toBe(false);
    expect(metodo("arquivo", "insert")).toHaveLength(0);
  });
});

describe("registrarOcorrencia", () => {
  it("sem descrição devolve o campo marcado e não grava", async () => {
    const fd = new FormData();
    fd.set("viagem_id", VIAGEM);
    fd.set("tipo", "avaria");
    fd.set("descricao", "  ");
    const r = await registrarOcorrencia(null, fd);
    expect(r).toMatchObject({ ok: false, campos: { descricao: "Descreva a ocorrência." } });
    expect(consultas).toHaveLength(0);
  });
  it("grava a ocorrência e, com foto, a linha de arquivo OUTROS (14) da viagem", async () => {
    enfileirar("viagem_ocorrencia", { data: { id: OCORRENCIA } });
    enfileirar("tipo_arquivo", { data: { aplica_viagem: true } });
    enfileirar("arquivo", { error: null });
    const fd = new FormData();
    fd.set("viagem_id", VIAGEM);
    fd.set("tipo", "avaria");
    fd.set("descricao", "Lona rasgada na carreta 2");
    fd.set("foto_nome", "lona.png");
    fd.set("foto_mime", "image/png");
    fd.set("foto_tamanho", "5000");
    const r = await registrarOcorrencia(null, fd);
    expect(metodo("viagem_ocorrencia", "insert")[0]?.[0]).toEqual({ viagem_id: VIAGEM, tipo: "avaria", descricao: "Lona rasgada na carreta 2" });
    const arq = metodo("arquivo", "insert")[0]?.[0] as Record<string, unknown>;
    expect(arq).toMatchObject({ tipo_arquivo_id: 14, viagem_id: VIAGEM });
    expect(r).toEqual({ ok: true, dados: { id: OCORRENCIA, caminhoFoto: arq.storage_path, erroFoto: null } });
  });
});

describe("resolverOcorrencia", () => {
  it("sem texto não grava", async () => {
    await expect(resolverOcorrencia(OCORRENCIA, " ")).resolves.toEqual({ ok: false, erro: "Descreva como a ocorrência foi resolvida." });
    expect(consultas).toHaveLength(0);
  });
  it("grava resolução, quem e quando, só se ainda aberta", async () => {
    enfileirar("viagem_ocorrencia", { data: [{ id: OCORRENCIA, viagem_id: VIAGEM }] });
    await expect(resolverOcorrencia(OCORRENCIA, " Carga trocada no destino ")).resolves.toEqual({ ok: true, dados: undefined });
    const dados = metodo("viagem_ocorrencia", "update")[0]?.[0] as Record<string, unknown>;
    expect(dados).toMatchObject({ resolucao: "Carga trocada no destino", resolvida_por: "u-op" });
    expect(typeof dados.resolvida_em).toBe("string");
    expect(metodo("viagem_ocorrencia", "is")[0]).toEqual(["resolvida_em", null]);
  });
  it("já resolvida por outra pessoa: avisa para atualizar", async () => {
    enfileirar("viagem_ocorrencia", { data: [] }, { data: { resolvida_em: "2026-10-23T12:00:00Z" } });
    await expect(resolverOcorrencia(OCORRENCIA, "ok")).resolves.toEqual({
      ok: false,
      erro: "Esta ocorrência já foi resolvida. Atualize a página para ver a resolução.",
    });
  });
});
