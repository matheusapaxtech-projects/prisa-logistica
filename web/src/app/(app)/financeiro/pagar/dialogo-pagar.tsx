"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { FORMAS, ROTULO_ORIGEM } from "@/lib/contas";
import { hojeISO } from "@/lib/datas";
import { partesDaConta } from "@/lib/financeiro";
import { formato } from "@/lib/formato";
import { CampoDialogo } from "../contas-comum/campo-dialogo";
import { DialogoMotivo, type TextosMotivo } from "../contas-comum/dialogo-motivo";
import { ResumoConta } from "../contas-comum/resumo-conta";
import { cancelar, liberarAntecipacao, pagar } from "./actions";
import type { ContaPagar } from "./consultas";
import { lerPagamento, type CampoPagamento } from "./regras";

type ContaBancaria = { id: string; banco: string; agencia: string; numero: string; apelido: string | null };

/** Resumo da conta a pagar no alto do diálogo: número, descrição, favorecido e valor. */
function Resumo({ conta }: { conta: ContaPagar }) {
  return <ResumoConta numero={conta.numero} titulo={conta.descricao} quem={conta.favorecidoNome} vencimento={formato.data(conta.vencimento)} valor={formato.reais(conta.valor)} />;
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
    perigo: true,
  },
  liberar: {
    titulo: "Liberar a antecipação do saldo",
    explica: "Libera pagar o saldo do frete antes da entrega conferida. Fica registrado quem liberou e o motivo.",
    rotulo: "Motivo da liberação",
    voltar: "Voltar",
    enviar: "Liberar a antecipação",
    sucesso: "Antecipação liberada. O saldo já pode ser pago depois de aprovado.",
    para: "liberação",
    perigo: false,
  },
} as const satisfies Record<string, TextosMotivo>;

/* Pede o motivo para cancelar a conta ou liberar a antecipação do saldo do frete (só o administrador). */
export function DialogoMotivoPagar({ tipo, conta, aoFechar }: { tipo: "cancelar" | "liberar"; conta: ContaPagar; aoFechar: () => void }) {
  return (
    <DialogoMotivo
      textos={TEXTOS[tipo]}
      resumo={<Resumo conta={conta} />}
      acao={(motivo) => (tipo === "cancelar" ? cancelar(conta.id, motivo) : liberarAntecipacao(conta.id, motivo))}
      aoFechar={aoFechar}
    />
  );
}
