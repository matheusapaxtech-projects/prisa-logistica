"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { CircleAlert, Undo2 } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { Sinal } from "@/components/Sinal";
import { TIPOS_ACEITOS } from "@/lib/arquivos";
import { lerNumeroBr } from "@/lib/formato";
import { chaveDfeValida, rotuloDe, type Cartao, type Formulario, type StatusCampo } from "@/lib/quadro";
import { TIPOS_PAUSA } from "../viagens/regras";

/* Diálogos do Quadro: "Mover" (a alternativa sem arrastar: teclado, toque e leitor de tela) e os
   formulários curtos das passagens que pedem dados (ver `formularioDaPassagem`). Campos não
   controlados; o envio valida aqui o que dá para validar (peso, chaves) e chama `executar`, que
   grava pelo banco. Recusa comum aparece no diálogo, que fica aberto com o que foi digitado. */

export type Passagem = { cartao: Cartao; de: StatusCampo; para: StatusCampo; formulario: Exclude<Formulario, null> };

/** Grava a passagem. Devolve a frase do erro (o diálogo continua aberto) ou `null` quando terminou
   (gravou, ou o quadro estava atrasado e a tela recarregou): aí quem abriu fecha o diálogo. */
export type Executar = (para: StatusCampo, dados: Record<string, unknown>) => Promise<string | null>;

/** Envia o canhoto (linha em `arquivo` + objeto no Storage). Erro = frase da tela. */
export type EnviarCanhoto = (viagemId: string, arquivo: File) => Promise<{ ok: true } | { ok: false; erro: string }>;

function ErroDialogo({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return (
    <div className="aviso aviso-bloqueado" role="alert">
      <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>{erro}</span>
    </div>
  );
}

const numeroDe = (c: Cartao) => c.numero ?? "—";

/* ---------- Mover ---------- */

type MenuProps = {
  cartao: Cartao;
  de: StatusCampo;
  destinos: StatusCampo[];
  /** Coluna para onde "Voltar" leva (pede motivo); `null` sem volta possível. */
  anterior: StatusCampo | null;
  aoEscolher: (para: StatusCampo) => void;
  aoFechar: () => void;
};

/** "Mover a viagem #N": os destinos permitidos e, se houver, "Voltar para <coluna anterior>". */
export function MenuMover({ cartao, de, destinos, anterior, aoEscolher, aoFechar }: MenuProps) {
  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={`Mover a viagem #${numeroDe(cartao)}`}
      className="dlg-mover"
      pe={
        <button className="btn" type="button" data-fechar>
          Fechar
        </button>
      }
    >
      <p>
        Está em “{rotuloDe(de)}”. {destinos.length ? "Para onde vai?" : "Não há coluna seguinte para esta viagem agora."}
      </p>
      {destinos.length > 0 && (
        <ul className="quadro-destinos" aria-label="Destinos">
          {destinos.map((d) => (
            <li key={d}>
              <button className="btn btn-grande" type="button" onClick={() => aoEscolher(d)}>
                {rotuloDe(d)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {anterior && (
        <div>
          <button className="btn btn-texto" type="button" onClick={() => aoEscolher(anterior)}>
            <Undo2 size={16} strokeWidth={1.6} aria-hidden="true" />
            Voltar para {rotuloDe(anterior)}
          </button>
          <p className="ajuda-dialogo">Para corrigir um clique errado. Pede o motivo, que fica na linha do tempo.</p>
        </div>
      )}
    </Dialogo>
  );
}

/* ---------- formulários das passagens ---------- */

type CampoProps = { id: string; rotulo: ReactNode; erro?: string; ajuda?: ReactNode; children: ReactNode };

function Campo({ id, rotulo, erro, ajuda, children }: CampoProps) {
  return (
    <div className="campo" data-invalido={erro ? "" : undefined}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro ? (
        <span className="erro" id={`${id}-erro`}>
          {erro}
        </span>
      ) : (
        ajuda && <span className="ajuda">{ajuda}</span>
      )}
    </div>
  );
}

const texto = (fd: FormData, nome: string) => String(fd.get(nome) ?? "").trim();

/** Peso digitado em pt-BR → número (Ruling R7) ou a frase do erro. */
function lerPeso(v: string, qual: "saída" | "chegada"): number | string {
  const n = lerNumeroBr(v);
  if (n === null) return `Informe o peso de ${qual} em kg.`;
  if (!Number.isFinite(n) || n <= 0) return `Peso de ${qual} inválido: use só números, como 37.000 ou 37000,5.`;
  return n;
}

const RESULTADOS = [
  { valor: "sem_divergencia", rotulo: "Sem divergência" },
  { valor: "falta", rotulo: "Falta" },
  { valor: "sobra", rotulo: "Sobra" },
  { valor: "avaria", rotulo: "Avaria" },
] as const;

const TITULOS: Record<Passagem["formulario"], string> = {
  checklist: "Checklist do veículo",
  peso_saida: "Peso de saída",
  documentos: "Documentos de saída",
  pausa: "Pausa",
  chegada: "Chegada",
  contagem: "Contagem",
  resolucao: "Resolução da divergência",
  encerramento: "Encerramento",
  motivo: "Voltar",
};

/** O que o motor de despacho confere antes de carregar (kanban.ts: "Checklist do veículo"). */
const CHECKLIST = [
  { nome: "carroceria", rotulo: "Carroceria limpa e sem avaria" },
  { nome: "lona", rotulo: "Lona e amarração em ordem" },
  { nome: "documentos", rotulo: "CRLV, CNH e tacógrafo conferidos (fotos)" },
] as const;

type DialogoProps = {
  passagem: Passagem;
  executar: Executar;
  enviarCanhoto: EnviarCanhoto;
  aoFechar: () => void;
};

/** O formulário curto da passagem. Fecha por "Cancelar", Esc ou quando `executar` termina. */
export function DialogoPassagem({ passagem, executar, enviarCanhoto, aoFechar }: DialogoProps) {
  const { cartao, de, para, formulario } = passagem;
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [canhotoEnviado, setCanhotoEnviado] = useState(Boolean(cartao.tem_canhoto));
  const [gravando, iniciar] = useTransition();
  const n = numeroDe(cartao);
  const voltar = formulario === "motivo";
  const semPagamento = (formulario === "documentos" && !cartao.pagamento_saida) || (formulario === "encerramento" && !cartao.saldo_pago);

  function gravar(paraFinal: StatusCampo, dados: Record<string, unknown>, arquivo?: File | null) {
    iniciar(async () => {
      if (arquivo) {
        // Ruling R13: o canhoto só conta com o objeto no Storage; envia antes de mover.
        const r = await enviarCanhoto(cartao.viagem_id ?? "", arquivo);
        if (!r.ok) return setErro(r.erro);
        setCanhotoEnviado(true);
      }
      const e = await executar(paraFinal, dados);
      if (e) setErro(e);
    });
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gravando) return;
    const fd = new FormData(e.currentTarget);
    const erros: Record<string, string> = {};
    let dados: Record<string, unknown> = {};
    let paraFinal = para;
    let arquivo: File | null = null;

    switch (formulario) {
      case "checklist": {
        const faltam = CHECKLIST.filter((c) => fd.get(c.nome) !== "sim");
        if (faltam.length) erros[faltam[0].nome] = "Confira todos os itens do checklist antes de carregar.";
        dados = { checklist_veiculo: true };
        break;
      }
      case "encerramento": {
        if (fd.get("mdfe_encerrado") !== "sim") erros.mdfe_encerrado = "Encerre o MDF-e antes de finalizar.";
        if (fd.get("ciot_encerrado") !== "sim") erros.ciot_encerrado = "Encerre o CIOT antes de finalizar.";
        dados = { mdfe_encerrado: true, ciot_encerrado: true };
        break;
      }
      case "peso_saida": {
        const p = lerPeso(texto(fd, "peso"), "saída");
        if (typeof p === "string") erros.peso = p;
        else dados = { peso_saida_kg: p };
        break;
      }
      case "documentos": {
        const cte = texto(fd, "chave_cte");
        const mdfe = texto(fd, "chave_mdfe");
        if (!chaveDfeValida(cte, "57")) erros.chave_cte = "Chave do CT-e inválida: confira os 44 dígitos (modelo 57).";
        if (!chaveDfeValida(mdfe, "58")) erros.chave_mdfe = "Chave do MDF-e inválida: confira os 44 dígitos (modelo 58).";
        const nfe = texto(fd, "chave_nfe");
        const ciot = texto(fd, "ciot").replace(/\D/g, "");
        const averbacao = texto(fd, "averbacao");
        if (!chaveDfeValida(nfe, "55")) erros.chave_nfe = "Chave da NF-e do cliente inválida: confira os 44 dígitos (modelo 55).";
        if (!/^\d{12,16}$/.test(ciot)) erros.ciot = "Informe o número do CIOT (12 a 16 dígitos).";
        if (!averbacao) erros.averbacao = "Informe o número da averbação do seguro.";
        dados = { chave_cte: cte, chave_mdfe: mdfe, chave_nfe: nfe, ciot, averbacao };
        break;
      }
      case "pausa": {
        const tipo = texto(fd, "pausa_tipo");
        const prog = fd.get("pausa_programada");
        if (!tipo) erros.pausa_tipo = "Escolha o tipo da pausa.";
        if (prog !== "sim" && prog !== "nao") erros.pausa_programada = "Diga se a pausa é programada.";
        dados = { pausa_tipo: tipo, pausa_programada: prog === "sim" };
        break;
      }
      case "chegada": {
        const campoArquivo = e.currentTarget.elements.namedItem("canhoto");
        const f = campoArquivo instanceof HTMLInputElement ? campoArquivo.files?.[0] : null;
        const p = lerPeso(texto(fd, "peso"), "chegada");
        if (typeof p === "string") erros.peso = p;
        else dados = { peso_chegada_kg: p };
        arquivo = f && f.size > 0 ? f : null;
        if (!arquivo && !canhotoEnviado) erros.canhoto = "Escolha a foto ou o PDF do canhoto assinado.";
        break;
      }
      case "contagem": {
        const r = texto(fd, "divergencia");
        const desc = texto(fd, "divergencia_descricao");
        if (!r) erros.divergencia = "Escolha o resultado da contagem.";
        else if (r === "sem_divergencia") {
          paraFinal = "aguardando_saldo";
          dados = { divergencia: r };
        } else {
          paraFinal = "resolucao_divergencia";
          if (!desc) erros.divergencia_descricao = "Descreva a divergência (o que faltou, sobrou ou avariou).";
          dados = { divergencia: r, divergencia_descricao: desc };
        }
        break;
      }
      case "resolucao": {
        const r = texto(fd, "resolucao");
        if (!r) erros.resolucao = "Descreva a resolução (desconto no contrato, cobrança, sinistro…).";
        dados = { resolucao: r };
        break;
      }
      case "motivo": {
        const m = texto(fd, "motivo");
        if (!m) erros.motivo = "Informe o motivo para voltar a viagem.";
        dados = { motivo: m };
        break;
      }
    }

    setCampos(erros);
    const lista = Object.values(erros);
    if (lista.length) {
      setErro(lista.length === 1 ? lista[0] : "Confira os campos marcados.");
      const el = e.currentTarget.elements.namedItem(Object.keys(erros)[0]);
      if (el instanceof HTMLElement) el.focus();
      else if (el instanceof RadioNodeList && el[0] instanceof HTMLElement) el[0].focus();
      return;
    }
    setErro(null);
    gravar(paraFinal, dados, formulario === "chegada" ? arquivo : null);
  }

  const titulo = voltar
    ? `Voltar a viagem #${n} para “${rotuloDe(para)}”`
    : `${TITULOS[formulario]} da viagem #${n}`;
  const acao = voltar ? "Voltar a viagem" : "Mover";
  const desc = (k: string) => (campos[k] ? `${k}-erro` : undefined);

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={titulo}
      className="dlg-passagem"
      onSubmit={enviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar disabled={gravando}>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando || semPagamento}>
            {gravando ? "Gravando…" : acao}
          </button>
        </>
      }
    >
      <ErroDialogo erro={erro} />
      {!voltar && formulario !== "contagem" && (
        <p>
          De “{rotuloDe(de)}” para “{rotuloDe(para)}”.
        </p>
      )}

      {(formulario === "peso_saida" || formulario === "chegada") && (
        <Campo
          id="passagem-peso"
          rotulo={formulario === "peso_saida" ? "Peso de saída (kg)" : "Peso de chegada (kg)"}
          erro={campos.peso}
          ajuda="Como no ticket da balança: 37.000 ou 37000,5."
        >
          <input
            id="passagem-peso"
            name="peso"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={campos.peso ? true : undefined}
            aria-describedby={desc("peso")}
          />
        </Campo>
      )}

      {formulario === "chegada" && (
        <Campo
          id="passagem-canhoto"
          rotulo={canhotoEnviado ? "Canhoto (opcional: o canhoto já foi enviado)" : "Canhoto (foto ou PDF)"}
          erro={campos.canhoto}
          ajuda="Foto ou PDF do canhoto assinado: PDF, JPG, PNG ou HEIC de até 20 MB. Ele é enviado antes de mover."
        >
          <input
            id="passagem-canhoto"
            name="canhoto"
            type="file"
            accept={TIPOS_ACEITOS}
            aria-invalid={campos.canhoto ? true : undefined}
            aria-describedby={desc("canhoto")}
          />
        </Campo>
      )}

      {formulario === "documentos" && (
        <>
          {cartao.pagamento_saida ? (
            <p>
              <Sinal tipo="normal" texto="Adiantamento e vale-pedágio confirmados" />
            </p>
          ) : (
            <div className="aviso aviso-pendente">
              <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>
                Falta confirmar o adiantamento e o vale-pedágio. Use “Confirmar pagamento de saída” no cartão; sem isso a viagem não vai
                para “Em rota”.
              </span>
            </div>
          )}
          <Campo id="passagem-cte" rotulo="Chave do CT-e" erro={campos.chave_cte} ajuda="44 dígitos; pode colar com espaços ou pontos.">
            <input
              id="passagem-cte"
              name="chave_cte"
              inputMode="numeric"
              autoComplete="off"
              className="mono"
              aria-invalid={campos.chave_cte ? true : undefined}
              aria-describedby={desc("chave_cte")}
            />
          </Campo>
          <Campo id="passagem-mdfe" rotulo="Chave do MDF-e" erro={campos.chave_mdfe} ajuda="44 dígitos; pode colar com espaços ou pontos.">
            <input
              id="passagem-mdfe"
              name="chave_mdfe"
              inputMode="numeric"
              autoComplete="off"
              className="mono"
              aria-invalid={campos.chave_mdfe ? true : undefined}
              aria-describedby={desc("chave_mdfe")}
            />
          </Campo>
          <Campo id="passagem-nfe" rotulo="Chave da NF-e do cliente" erro={campos.chave_nfe} ajuda="44 dígitos da nota fiscal da carga (modelo 55).">
            <input
              id="passagem-nfe"
              name="chave_nfe"
              inputMode="numeric"
              autoComplete="off"
              className="mono"
              aria-invalid={campos.chave_nfe ? true : undefined}
              aria-describedby={desc("chave_nfe")}
            />
          </Campo>
          <Campo id="passagem-ciot" rotulo="Número do CIOT" erro={campos.ciot} ajuda="O código do CIOT emitido para esta viagem.">
            <input
              id="passagem-ciot"
              name="ciot"
              inputMode="numeric"
              autoComplete="off"
              className="mono"
              aria-invalid={campos.ciot ? true : undefined}
              aria-describedby={desc("ciot")}
            />
          </Campo>
          <Campo id="passagem-averbacao" rotulo="Averbação do seguro" erro={campos.averbacao} ajuda="Número da averbação da carga na apólice.">
            <input
              id="passagem-averbacao"
              name="averbacao"
              autoComplete="off"
              maxLength={60}
              aria-invalid={campos.averbacao ? true : undefined}
              aria-describedby={desc("averbacao")}
            />
          </Campo>
        </>
      )}

      {formulario === "checklist" && (
        <fieldset className="campo" data-invalido={CHECKLIST.some((c) => campos[c.nome]) ? "" : undefined}>
          <legend className="rotulo">Antes de entrar para carregar</legend>
          <div className="checklist-passagem">
            {CHECKLIST.map((c) => (
              <label key={c.nome} className="marcar">
                <input type="checkbox" name={c.nome} value="sim" />
                <span>{c.rotulo}</span>
              </label>
            ))}
          </div>
          {CHECKLIST.some((c) => campos[c.nome]) && <span className="erro">Confira todos os itens do checklist antes de carregar.</span>}
        </fieldset>
      )}

      {formulario === "encerramento" && (
        <>
          {cartao.saldo_pago ? (
            <p>
              <Sinal tipo="normal" texto="Saldo de 30% pago" />
            </p>
          ) : (
            <div className="aviso aviso-pendente">
              <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>Falta confirmar o pagamento do saldo. Use “Confirmar pagamento do saldo” no cartão; sem isso a viagem não finaliza.</span>
            </div>
          )}
          <fieldset className="campo" data-invalido={campos.mdfe_encerrado || campos.ciot_encerrado ? "" : undefined}>
            <legend className="rotulo">Encerramentos</legend>
            <div className="checklist-passagem">
              <label className="marcar">
                <input type="checkbox" name="mdfe_encerrado" value="sim" />
                <span>MDF-e encerrado</span>
              </label>
              <label className="marcar">
                <input type="checkbox" name="ciot_encerrado" value="sim" />
                <span>CIOT encerrado</span>
              </label>
            </div>
            {(campos.mdfe_encerrado || campos.ciot_encerrado) && <span className="erro">{campos.mdfe_encerrado ?? campos.ciot_encerrado}</span>}
          </fieldset>
        </>
      )}

      {formulario === "pausa" && (
        <>
          <Campo id="passagem-pausa-tipo" rotulo="Tipo da pausa" erro={campos.pausa_tipo}>
            <select
              id="passagem-pausa-tipo"
              name="pausa_tipo"
              defaultValue=""
              aria-invalid={campos.pausa_tipo ? true : undefined}
              aria-describedby={desc("pausa_tipo")}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {Object.entries(TIPOS_PAUSA).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </Campo>
          <fieldset className="campo" data-invalido={campos.pausa_programada ? "" : undefined}>
            <legend className="rotulo">É programada?</legend>
            <div className="opcoes">
              <label className="opcao">
                <input type="radio" name="pausa_programada" value="sim" />
                <span>Programada</span>
              </label>
              <label className="opcao">
                <input type="radio" name="pausa_programada" value="nao" />
                <span>Não programada</span>
              </label>
            </div>
            {campos.pausa_programada && <span className="erro">{campos.pausa_programada}</span>}
          </fieldset>
        </>
      )}

      {formulario === "contagem" && (
        <>
          <p>
            Sem divergência, a viagem vai para “Aguardando saldo (30%)”. Com falta, sobra ou avaria, vai para “Resolução de divergência na
            carga”.
          </p>
          <fieldset className="campo" data-invalido={campos.divergencia ? "" : undefined}>
            <legend className="rotulo">Resultado da contagem</legend>
            <div className="opcoes">
              {RESULTADOS.map((r) => (
                <label className="opcao" key={r.valor}>
                  <input
                    type="radio"
                    name="divergencia"
                    value={r.valor}
                    defaultChecked={para === "aguardando_saldo" ? r.valor === "sem_divergencia" : false}
                  />
                  <span>{r.rotulo}</span>
                </label>
              ))}
            </div>
            {campos.divergencia && <span className="erro">{campos.divergencia}</span>}
          </fieldset>
          <Campo
            id="passagem-divergencia"
            rotulo={
              <>
                Descrição da divergência <span className="opcional">(com falta, sobra ou avaria)</span>
              </>
            }
            erro={campos.divergencia_descricao}
          >
            <textarea
              id="passagem-divergencia"
              name="divergencia_descricao"
              maxLength={2000}
              placeholder="Ex.: faltaram 320 kg na balança do destino"
              aria-invalid={campos.divergencia_descricao ? true : undefined}
              aria-describedby={desc("divergencia_descricao")}
            />
          </Campo>
        </>
      )}

      {formulario === "resolucao" && (
        <Campo id="passagem-resolucao" rotulo="Resolução" erro={campos.resolucao}>
          <textarea
            id="passagem-resolucao"
            name="resolucao"
            maxLength={2000}
            placeholder="Ex.: desconto de 320 kg no contrato do motorista"
            aria-invalid={campos.resolucao ? true : undefined}
            aria-describedby={desc("resolucao")}
          />
        </Campo>
      )}

      {formulario === "motivo" && (
        <>
          <p>
            A viagem volta de “{rotuloDe(de)}” para “{rotuloDe(para)}”. O que foi gravado (peso, pagamento) continua; o motivo fica na linha
            do tempo.
          </p>
          <Campo id="passagem-motivo" rotulo="Motivo" erro={campos.motivo}>
            <textarea
              id="passagem-motivo"
              name="motivo"
              maxLength={2000}
              placeholder="Ex.: cliquei na coluna errada"
              aria-invalid={campos.motivo ? true : undefined}
              aria-describedby={desc("motivo")}
            />
          </Campo>
        </>
      )}
    </Dialogo>
  );
}

/* ---------- pagamento de saída e saldo ---------- */

/** Confirma o adiantamento e o vale-pedágio ou, em "Aguardando saldo", o saldo de 30% (financeiro, operação ou admin). */
export function DialogoPagamento({
  cartao,
  confirmar,
  aoFechar,
}: {
  cartao: Cartao;
  confirmar: () => Promise<string | null>;
  aoFechar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={`${cartao.status_campo === "aguardando_saldo" ? "Saldo" : "Pagamento de saída"} da viagem #${numeroDe(cartao)}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (gravando) return;
        setErro(null);
        iniciar(async () => {
          const r = await confirmar();
          if (r) setErro(r);
        });
      }}
      pe={
        <>
          <button className="btn" type="button" data-fechar disabled={gravando}>
            Voltar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando}>
            {gravando ? "Confirmando…" : "Confirmar"}
          </button>
        </>
      }
    >
      <ErroDialogo erro={erro} />
      <p>
        {cartao.status_campo === "aguardando_saldo"
          ? "Confirme só depois que o saldo de 30% estiver pago ao motorista (até 30 dias úteis da entrega, Lei 15.485/2026)."
          : "Confirme só depois que o adiantamento e o vale-pedágio estiverem resolvidos."}{" "}
        Fica gravado quem confirmou e quando; não dá para desfazer.
      </p>
    </Dialogo>
  );
}
