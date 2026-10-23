"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleAlert, Info } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { cancelarPedido } from "../actions";

type Props = {
  pedidoId: string;
  numero: number;
  /** Por que não dá para cancelar agora (viagem iniciada ou planejada); `null` = pode. */
  bloqueio: string | null;
};

/* "Cancelar pedido" da ficha: pede o motivo e grava. Com viagem viva, o diálogo só explica o que fazer
   antes (a ação do servidor confere de novo). */
export function CancelarPedido({ pedidoId, numero, bloqueio }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vez, setVez] = useState(0);
  const [gravando, iniciar] = useTransition();

  function confirmar(motivo: string) {
    setErro(null);
    iniciar(async () => {
      const r = await cancelarPedido(pedidoId, motivo);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAberto(false);
      toast(`Pedido #${numero} cancelado.`, "check");
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="btn btn-perigo"
        type="button"
        id="btn-cancelar-pedido"
        onClick={() => {
          setErro(null);
          setVez((n) => n + 1);
          setAberto(true);
        }}
      >
        <Ban size={16} strokeWidth={1.6} aria-hidden="true" />
        Cancelar pedido
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Cancelar o pedido #${numero}`}
        className="dlg-cancelar"
        onSubmit={(e) => {
          e.preventDefault();
          if (bloqueio || gravando) return;
          confirmar(String(new FormData(e.currentTarget).get("motivo") ?? ""));
        }}
        pe={
          bloqueio ? (
            <button className="btn" type="button" data-fechar>
              Entendi
            </button>
          ) : (
            <>
              <button className="btn" type="button" data-fechar disabled={gravando}>
                Voltar
              </button>
              <button className="btn btn-perigo" type="submit" disabled={gravando}>
                {gravando ? "Cancelando…" : "Cancelar pedido"}
              </button>
            </>
          )
        }
      >
        {bloqueio ? (
          <div className="aviso aviso-info">
            <Info size={16} strokeWidth={1.6} aria-hidden="true" />
            <span>{bloqueio}</span>
          </div>
        ) : (
          <>
            {erro && (
              <div className="aviso aviso-bloqueado" role="alert">
                <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
                <span>{erro}</span>
              </div>
            )}
            <p>O pedido sai de “A planejar” e não recebe mais viagens. O motivo fica na observação do pedido.</p>
            <div className="campo" key={vez}>
              <label htmlFor="motivo-cancelamento">Motivo</label>
              <textarea id="motivo-cancelamento" name="motivo" maxLength={500} required placeholder="Ex.: cliente desistiu da carga" />
            </div>
          </>
        )}
      </Dialogo>
    </>
  );
}
