"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { hojeISO } from "@/lib/datas";
import { partesDaConta } from "@/lib/financeiro";
import { formato } from "@/lib/formato";
import { CampoDialogo } from "../pagar/dialogo-conta";
import { lerMotivo, MAX_MOTIVO } from "../pagar/regras";
import { cancelarReceber, desfazerRecebimento, receberTitulo } from "./actions";
import type { TituloReceber } from "./consultas";
import { lerRecebimento, type CampoRecebimento } from "./regras";

type ContaBancaria = { id: string; banco: string; agencia: string; numero: string; apelido: string | null };

/** Resumo do título no alto do diálogo: número, título, cliente, vencimento e valor. */
function Resumo({ titulo }: { titulo: TituloReceber }) {
  return (
    <p className="contas-resumo">
      <b>
        Conta {titulo.numero} · {titulo.titulo}
      </b>
      <span className="linha2">
        {titulo.clienteNome} · vence em {formato.data(titulo.vencimento)} · {formato.reais(titulo.valor)}
      </span>
    </p>
  );
}

/* Diálogo "Receber": a data do recebimento (hoje ou antes) e a conta bancária onde o dinheiro caiu (dinheiro em mãos
   não tem). Monte o diálogo só quando for abrir. */
export function DialogoReceber({ titulo, contas, aoFechar }: { titulo: TituloReceber; contas: ContaBancaria[]; aoFechar: () => void }) {
  const id = useId();
  const hoje = hojeISO();
  const [erros, setErros] = useState<Partial<Record<CampoRecebimento, string>>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const campo = (c: CampoRecebimento) => `${id}-${c}`;
  const descrito = (c: CampoRecebimento) => (erros[c] ? `${campo(c)}-erro` : undefined);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setErroAcao(null);
    const lido = lerRecebimento(dados, hoje);
    if (!lido.ok) {
      setErros(lido.erros);
      form.querySelector<HTMLElement>(`[name="${Object.keys(lido.erros)[0]}"]`)?.focus();
      return;
    }
    setErros({});
    iniciar(async () => {
      const r = await receberTitulo(titulo.id, dados);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast("Recebimento registrado.");
      aoFechar();
    });
  }

  function limpar(e: FormEvent<HTMLDivElement>) {
    const nome = (e.target as HTMLElement).getAttribute("name") as CampoRecebimento | null;
    if (nome && erros[nome]) setErros((antes) => ({ ...antes, [nome]: undefined }));
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Receber a conta"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
            Registrar o recebimento
          </button>
        </>
      }
    >
      <Resumo titulo={titulo} />
      <div className="campos" onInput={limpar}>
        <CampoDialogo classe="f4" id={campo("data")} rotulo="Data do recebimento" erro={erros.data}>
          <input id={campo("data")} name="data" type="date" defaultValue={hoje} max={hoje} aria-invalid={!!erros.data || undefined} aria-describedby={descrito("data")} />
        </CampoDialogo>
        <CampoDialogo classe="f8" id={campo("conta")} rotulo="Conta bancária" opcional erro={erros.conta}>
          <select id={campo("conta")} name="conta" defaultValue="" aria-invalid={!!erros.conta || undefined} aria-describedby={descrito("conta")}>
            <option value="">Sem conta bancária (dinheiro)</option>
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

/* Diálogo que pede o motivo do cancelamento. O título continua na lista como cancelado, com o motivo. */
export function DialogoCancelarTitulo({ titulo, aoFechar }: { titulo: TituloReceber; aoFechar: () => void }) {
  const id = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "");
    setErroAcao(null);
    const lido = lerMotivo(motivo, "cancelamento");
    if (!lido.ok) {
      setErro(lido.erro);
      e.currentTarget.querySelector<HTMLElement>('[name="motivo"]')?.focus();
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await cancelarReceber(titulo.id, lido.motivo);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast("Conta cancelada.");
      aoFechar();
    });
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Cancelar a conta a receber"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Voltar
          </button>
          <button className="btn btn-perigo" type="submit" disabled={gravando} aria-busy={gravando}>
            Cancelar a conta
          </button>
        </>
      }
    >
      <Resumo titulo={titulo} />
      <p className="nota">A conta continua na lista como cancelada, com o motivo, e não muda mais.</p>
      <div className="campos" onInput={() => erro && setErro(null)}>
        <CampoDialogo classe="f12" id={`${id}-motivo`} rotulo="Motivo do cancelamento" erro={erro ?? undefined}>
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

/* Confirmação de "Desfazer recebimento": o título volta para em aberto e perde a data e a conta do recebimento. */
export function DialogoDesfazerRecebimento({ titulo, aoFechar }: { titulo: TituloReceber; aoFechar: () => void }) {
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroAcao(null);
    iniciar(async () => {
      const r = await desfazerRecebimento(titulo.id);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast("Recebimento desfeito.");
      aoFechar();
    });
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Desfazer o recebimento"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Voltar
          </button>
          <button className="btn btn-perigo" type="submit" disabled={gravando} aria-busy={gravando}>
            Desfazer o recebimento
          </button>
        </>
      }
    >
      <Resumo titulo={titulo} />
      <p className="nota">
        {titulo.recebidoEm ? `O recebimento de ${formato.data(titulo.recebidoEm)} será apagado e ` : "O recebimento será apagado e "}a conta volta para
        em aberto.
      </p>
      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}
