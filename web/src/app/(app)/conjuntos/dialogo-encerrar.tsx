"use client";

import { useState, useTransition } from "react";
import { CircleAlert, Unlink } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { hojeISO } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { encerrarConjunto } from "./actions";

export type ConjuntoEncerrar = { id: string; nome: string; motorista: string | null };

/* "Encerrar conjunto" (`pedirEncerrar` de prototipo/conjunto.html): nomeia o conjunto, diz o que
   acontece e só encerra ao confirmar. Usado na ficha e no montador (conjunto que prende o cavalo). */
export function DialogoEncerrar({
  conjunto,
  aoFechar,
  aoEncerrar,
}: {
  /** Conjunto a encerrar; `null` = diálogo fechado. */
  conjunto: ConjuntoEncerrar | null;
  aoFechar: () => void;
  aoEncerrar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  return (
    <Dialogo
      aberto={!!conjunto}
      aoFechar={() => {
        setErro(null);
        aoFechar();
      }}
      titulo={conjunto ? `Encerrar o conjunto ${conjunto.nome}?` : "Encerrar conjunto"}
      onSubmit={(e) => {
        e.preventDefault();
        if (!conjunto || enviando) return;
        iniciar(async () => {
          const r = await encerrarConjunto(conjunto.id);
          if (!r.ok) {
            setErro(r.erro);
            return;
          }
          setErro(null);
          toast(`Conjunto ${conjunto.nome} encerrado`);
          aoEncerrar();
        });
      }}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-perigo" type="submit" disabled={enviando}>
            <Unlink size={16} strokeWidth={1.6} aria-hidden="true" />
            Encerrar conjunto
          </button>
        </>
      }
    >
      {conjunto && (
        <>
          <p>
            O conjunto sai dos abertos e vai para o histórico com fim em {formato.data(hojeISO())}.
            {conjunto.motorista ? ` ${conjunto.motorista} deixa de constar como motorista dele.` : ""} O cavalo e as peças ficam livres
            para montar outro conjunto.
          </p>
          <p className="muted">Nada é apagado: o histórico guarda o início, o fim e as peças.</p>
          {erro && (
            <div className="aviso aviso-bloqueado" role="alert" style={{ marginTop: 12 }}>
              <CircleAlert size={18} strokeWidth={1.6} aria-hidden="true" />
              <div>{erro}</div>
            </div>
          )}
        </>
      )}
    </Dialogo>
  );
}
