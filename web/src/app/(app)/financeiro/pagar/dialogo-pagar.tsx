"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { FORMAS, ROTULO_ORIGEM } from "@/lib/contas";
import { hojeISO } from "@/lib/datas";
import { partesDaConta } from "@/lib/financeiro";
import { formato } from "@/lib/formato";
import { cancelar, liberarAntecipacao, pagar } from "./actions";
import type { ContaPagar } from "./consultas";
import { CampoDialogo } from "./dialogo-conta";
import { lerMotivo, lerPagamento, MAX_MOTIVO, type CampoPagamento } from "./regras";

type ContaBancaria = { id: string; banco: string; agencia: string; numero: string; apelido: string | null };

/** Resumo da conta no alto do diálogo: número, descrição, favorecido e valor. */
function Resumo({ conta }: { conta: ContaPagar }) {
  return (
    <p className="contas-resumo">
      <b>
        Conta {conta.numero} · {conta.descricao}
      </b>
      <span className="linha2">
        {conta.favorecidoNome} · vence em {formato.data(conta.vencimento)} · {formato.reais(conta.valor)}
      </span>
    </p>
  );
}

/* Diálogo "Pagar": a data do pagamento (hoje ou antes), a conta bancária de onde saiu (o cartão-frete e o dinheiro
   não têm) e a forma. O banco só deixa pagar conta aprovada e confere as regras do frete (embarque e entrega). Monte
   o diálogo só quando for abrir. */
export function DialogoPagar({ conta, contas, aoFechar }: { conta: ContaPagar; contas: ContaBancaria[]; aoFechar: () => void }) {
  const id = useId();
  const hoje = hojeISO();
  const [erros, setErros] = useState<Partial<Record<CampoPagamento, string>>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const campo = (c: CampoPagamento) => `${id}-${c}`;
  const descrito = (c: CampoPagamento) => (erros[c] ? `${campo(c)}-erro` : undefined);
  const saldoSemLiberar = conta.origem === "frete_saldo" && !conta.antecipacaoLiberadaEm;

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setErroAcao(null);
    const lido = lerPagamento(dados, hoje);
    if (!lido.ok) {
      setErros(lido.erros);
      form.querySelector<HTMLElement>(`[name="${Object.keys(lido.erros)[0]}"]`)?.focus();
      return;
    }
    setErros({});
    iniciar(async () => {
      const r = await pagar(conta.id, dados);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast("Pagamento registrado.");
      aoFechar();
    });
  }

  function limpar(e: FormEvent<HTMLDivElement>) {
    const nome = (e.target as HTMLElement).getAttribute("name") as CampoPagamento | null;
    if (nome && erros[nome]) setErros((antes) => ({ ...antes, [nome]: undefined }));
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Pagar a conta"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
            Registrar o pagamento
          </button>
        </>
      }
    >
      <Resumo conta={conta} />
      {conta.origem !== "manual" && <p className="nota">{ROTULO_ORIGEM[conta.origem]}</p>}
      {saldoSemLiberar && (
        <div className="aviso aviso-info" role="note">
          <p>O saldo só é pago com a entrega conferida (viagem em Aguardando saldo). O administrador pode liberar a antecipação.</p>
        </div>
      )}
      <div className="campos" onInput={limpar}>
        <CampoDialogo classe="f4" id={campo("data")} rotulo="Data do pagamento" erro={erros.data}>
          <input id={campo("data")} name="data" type="date" defaultValue={hoje} max={hoje} aria-invalid={!!erros.data || undefined} aria-describedby={descrito("data")} />
        </CampoDialogo>
        <CampoDialogo classe="f8" id={campo("forma")} rotulo="Forma de pagamento" erro={erros.forma}>
          <select id={campo("forma")} name="forma" defaultValue={conta.forma} aria-invalid={!!erros.forma || undefined} aria-describedby={descrito("forma")}>
            {FORMAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </CampoDialogo>
        <CampoDialogo classe="f12" id={campo("conta")} rotulo="Conta bancária" opcional erro={erros.conta}>
          <select id={campo("conta")} name="conta" defaultValue="" aria-invalid={!!erros.conta || undefined} aria-describedby={descrito("conta")}>
            <option value="">Sem conta bancária (cartão-frete ou dinheiro)</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {partesDaConta(c).join(" · ")}
              </option>
            ))}
          </select>
        </CampoDialogo>
      </div>
      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}

const TEXTOS = {
  cancelar: {
    titulo: "Cancelar a conta",
    explica: "A conta continua na lista como cancelada, com o motivo, e não muda mais.",
    rotulo: "Motivo do cancelamento",
    voltar: "Voltar",
    enviar: "Cancelar a conta",
    sucesso: "Conta cancelada.",
    para: "cancelamento",
  },
  liberar: {
    titulo: "Liberar a antecipação do saldo",
    explica: "Libera pagar o saldo do frete antes da entrega conferida. Fica registrado quem liberou e o motivo.",
    rotulo: "Motivo da liberação",
    voltar: "Voltar",
    enviar: "Liberar a antecipação",
    sucesso: "Antecipação liberada. O saldo já pode ser pago depois de aprovado.",
    para: "liberação",
  },
} as const;

/* Diálogo que pede o motivo: cancelar a conta ou liberar a antecipação do saldo do frete (só o administrador). */
export function DialogoMotivo({ tipo, conta, aoFechar }: { tipo: "cancelar" | "liberar"; conta: ContaPagar; aoFechar: () => void }) {
  const id = useId();
  const t = TEXTOS[tipo];
  const [erro, setErro] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "");
    setErroAcao(null);
    const lido = lerMotivo(motivo, t.para);
    if (!lido.ok) {
      setErro(lido.erro);
      e.currentTarget.querySelector<HTMLElement>('[name="motivo"]')?.focus();
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = tipo === "cancelar" ? await cancelar(conta.id, lido.motivo) : await liberarAntecipacao(conta.id, lido.motivo);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast(t.sucesso);
      aoFechar();
    });
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={t.titulo}
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            {t.voltar}
          </button>
          <button className={`btn ${tipo === "cancelar" ? "btn-perigo" : "btn-primario"}`} type="submit" disabled={gravando} aria-busy={gravando}>
            {t.enviar}
          </button>
        </>
      }
    >
      <Resumo conta={conta} />
      <p className="nota">{t.explica}</p>
      <div className="campos" onInput={() => erro && setErro(null)}>
        <CampoDialogo classe="f12" id={`${id}-motivo`} rotulo={t.rotulo} erro={erro ?? undefined}>
          <textarea
            id={`${id}-motivo`}
            name="motivo"
            rows={3}
            maxLength={MAX_MOTIVO}
            aria-invalid={!!erro || undefined}
            aria-describedby={erro ? `${id}-motivo-erro` : undefined}
          />
        </CampoDialogo>
      </div>
      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}
