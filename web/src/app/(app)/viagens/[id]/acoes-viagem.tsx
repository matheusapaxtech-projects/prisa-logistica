"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleAlert, Play, ShieldAlert, Wallet } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { cancelarViagem, confirmarPagamentoSaida, confirmarSaldo, iniciarViagem } from "../actions";
import { MSG_SO_ADMIN_EXCECAO, type ItemAptidao, type ModoInicio } from "../regras";

/* Ações da ficha da viagem que chamam as RPCs do banco. A recusa do banco aparece como está e a
   ficha recarrega (a viagem pode ter mudado nas mãos de outra pessoa). */

function ErroDialogo({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return (
    <div className="aviso aviso-bloqueado" role="alert">
      <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>{erro}</span>
    </div>
  );
}

/** "Iniciar trânsito": direto (apta ou só avisos), com justificativa (admin com trava), desabilitado
   (trava e não admin, ou trava legal). */
export function IniciarViagem({ viagemId, numero, modo, travas }: { viagemId: string; numero: number; modo: ModoInicio; travas: ItemAptidao[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vez, setVez] = useState(0);
  const [gravando, iniciar] = useTransition();

  function gravar(justificativa?: string) {
    setErro(null);
    iniciar(async () => {
      const r = await iniciarViagem(viagemId, justificativa);
      if (!r.ok) {
        if (justificativa !== undefined) setErro(r.erro);
        else toast(r.erro, "alert-circle");
        router.refresh();
        return;
      }
      setAberto(false);
      toast(`Viagem #${numero} iniciada: está em Trânsito.`, "check");
      router.refresh();
    });
  }

  if (modo === "bloqueado" || modo === "so_admin") {
    const explica = modo === "so_admin" ? MSG_SO_ADMIN_EXCECAO : "Há trava legal: esta viagem não pode iniciar, nem com exceção.";
    return (
      <span className="acao-com-explica">
        <button className="btn btn-primario" type="button" id="btn-iniciar" disabled aria-describedby="explica-iniciar">
          <Play size={16} strokeWidth={1.6} aria-hidden="true" />
          Iniciar trânsito
        </button>
        <span className="explica" id="explica-iniciar">
          {explica}
        </span>
      </span>
    );
  }

  if (modo === "iniciar") {
    return (
      <button className="btn btn-primario" type="button" id="btn-iniciar" disabled={gravando} onClick={() => gravar()}>
        <Play size={16} strokeWidth={1.6} aria-hidden="true" />
        {gravando ? "Iniciando…" : "Iniciar trânsito"}
      </button>
    );
  }

  return (
    <>
      <button
        className="btn btn-primario"
        type="button"
        id="btn-iniciar"
        onClick={() => {
          setErro(null);
          setVez((n) => n + 1);
          setAberto(true);
        }}
      >
        <ShieldAlert size={16} strokeWidth={1.6} aria-hidden="true" />
        Iniciar com exceção
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Liberar a viagem #${numero} com exceção`}
        className="dlg-cancelar"
        onSubmit={(e) => {
          e.preventDefault();
          if (gravando) return;
          const j = String(new FormData(e.currentTarget).get("justificativa") ?? "").trim();
          if (!j) return setErro("Escreva a justificativa: ela fica gravada na viagem.");
          gravar(j);
        }}
        pe={
          <>
            <button className="btn" type="button" data-fechar disabled={gravando}>
              Voltar
            </button>
            <button className="btn btn-primario" type="submit" disabled={gravando}>
              {gravando ? "Iniciando…" : "Liberar e iniciar"}
            </button>
          </>
        }
      >
        <ErroDialogo erro={erro} />
        <p>A viagem tem trava. Você libera como administrador; a justificativa e as travas liberadas ficam na linha do tempo.</p>
        <ul className="lista-aptidao">
          {travas.map((t, i) => (
            <li key={i}>
              <Sinal tipo="bloqueado" texto="Trava" />
              <span>{t.mensagem}</span>
            </li>
          ))}
        </ul>
        <div className="campo" key={vez}>
          <label htmlFor="justificativa">Justificativa</label>
          <textarea id="justificativa" name="justificativa" maxLength={1000} required placeholder="Ex.: CNH renovada, o documento novo chega amanhã" />
        </div>
      </Dialogo>
    </>
  );
}

/** "Cancelar viagem": pede o motivo (planejada ou até "Aguardando NF e pagamento"; o banco confere). */
export function CancelarViagem({ viagemId, numero }: { viagemId: string; numero: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vez, setVez] = useState(0);
  const [gravando, iniciar] = useTransition();

  return (
    <>
      <button
        className="btn btn-perigo"
        type="button"
        id="btn-cancelar-viagem"
        onClick={() => {
          setErro(null);
          setVez((n) => n + 1);
          setAberto(true);
        }}
      >
        <Ban size={16} strokeWidth={1.6} aria-hidden="true" />
        Cancelar viagem
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Cancelar a viagem #${numero}`}
        className="dlg-cancelar"
        onSubmit={(e) => {
          e.preventDefault();
          if (gravando) return;
          const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "");
          setErro(null);
          iniciar(async () => {
            const r = await cancelarViagem(viagemId, motivo);
            if (!r.ok) {
              setErro(r.erro);
              router.refresh();
              return;
            }
            setAberto(false);
            toast(`Viagem #${numero} cancelada.`, "check");
            router.refresh();
          });
        }}
        pe={
          <>
            <button className="btn" type="button" data-fechar disabled={gravando}>
              Voltar
            </button>
            <button className="btn btn-perigo" type="submit" disabled={gravando}>
              {gravando ? "Cancelando…" : "Cancelar viagem"}
            </button>
          </>
        }
      >
        <ErroDialogo erro={erro} />
        <p>A viagem sai do Quadro e o peso volta para o saldo do pedido. O motivo fica na linha do tempo.</p>
        <div className="campo" key={vez}>
          <label htmlFor="motivo-cancelamento">Motivo</label>
          <textarea id="motivo-cancelamento" name="motivo" maxLength={500} required placeholder="Ex.: cliente adiou o carregamento" />
        </div>
      </Dialogo>
    </>
  );
}

/** "Confirmar pagamento de saída" (adiantamento e vale-pedágio) ou, com `saldo`, "Confirmar pagamento do saldo" (30%, motor
   de despacho): admin, operação ou financeiro. */
export function ConfirmarPagamento({
  viagemId,
  numero,
  primario = false,
  saldo = false,
}: {
  viagemId: string;
  numero: number;
  primario?: boolean;
  saldo?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  return (
    <>
      <button
        className={`btn${primario ? " btn-primario" : ""}`}
        type="button"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        <Wallet size={16} strokeWidth={1.6} aria-hidden="true" />
        {saldo ? "Confirmar pagamento do saldo" : "Confirmar pagamento de saída"}
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`${saldo ? "Saldo" : "Pagamento de saída"} da viagem #${numero}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (gravando) return;
          setErro(null);
          iniciar(async () => {
            const r = await (saldo ? confirmarSaldo : confirmarPagamentoSaida)(viagemId);
            if (!r.ok) {
              setErro(r.erro);
              router.refresh();
              return;
            }
            setAberto(false);
            toast(saldo ? "Saldo de 30% confirmado." : "Adiantamento e vale-pedágio confirmados.", "check");
            router.refresh();
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
          {saldo
            ? "Confirme só depois que o saldo de 30% estiver pago ao motorista (até 30 dias úteis da entrega, Lei 15.485/2026)."
            : "Confirme só depois que o adiantamento e o vale-pedágio estiverem resolvidos."}{" "}
          Fica gravado quem confirmou e quando; não dá para desfazer.
        </p>
      </Dialogo>
    </>
  );
}
