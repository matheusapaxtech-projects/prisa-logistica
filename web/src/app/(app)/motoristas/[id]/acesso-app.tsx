"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Smartphone } from "lucide-react";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { CabPainel } from "../../_pessoa/partes";
import { liberarAcessoApp, revogarAcessoApp } from "./acesso-app-actions";

export type AcessoApp = { celular: string; liberado_em: string; revogado_em: string | null } | null;

type Props = {
  motoristaId: string;
  acesso: AcessoApp;
  /** Celular com WhatsApp dos contatos, para sugerir. */
  sugestao: string;
  podeEditar: boolean;
};

/** 5543999998888 → (43) 99999-8888 */
function celularTela(c: string): string {
  const d = c.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : c;
}

/* Aba "App do motorista" da ficha: libera o celular em que ele entra no app (código pelo WhatsApp), troca o
   número ou revoga o acesso. */
export function AcessoAppPainel({ motoristaId, acesso, sugestao, podeEditar }: Props) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const ativo = acesso && !acesso.revogado_em;

  function liberar(celular: string) {
    setErro(null);
    iniciar(async () => {
      const r = await liberarAcessoApp(motoristaId, celular);
      if (!r.ok) return setErro(r.erro);
      toast(`App liberado para ${celularTela(r.dados)}.`, "check");
      router.refresh();
    });
  }

  function revogar() {
    setErro(null);
    iniciar(async () => {
      const r = await revogarAcessoApp(motoristaId);
      if (!r.ok) return setErro(r.erro);
      toast("Acesso ao app revogado.", "check");
      router.refresh();
    });
  }

  return (
    <section className="subsecao" aria-label="App do motorista">
      <CabPainel titulo="App do motorista" />
      <p className="nota">
        O motorista entra no app com o código que chega no WhatsApp do celular liberado aqui. No app ele avisa que está livre, vê os
        fretes publicados em que pode entrar, com o frete dele, e diz se tem interesse. Ele não vê o frete da empresa nem a margem.
      </p>
      <p>
        {ativo ? (
          <Sinal tipo="normal" texto={`Liberado para ${celularTela(acesso.celular)} desde ${formato.data(acesso.liberado_em)}`} />
        ) : acesso ? (
          <Sinal tipo="neutro" texto={`Revogado em ${formato.data(acesso.revogado_em!)}`} />
        ) : (
          <Sinal tipo="neutro" texto="Ainda sem acesso ao app" />
        )}
      </p>
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      {podeEditar && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!gravando) liberar(String(new FormData(e.currentTarget).get("celular") ?? ""));
          }}
        >
          <div className="campos">
          <div className="campo f6">
            <label htmlFor="celular-app">Celular com WhatsApp</label>
            <input
              id="celular-app"
              name="celular"
              inputMode="tel"
              autoComplete="off"
              required
              placeholder="(43) 99999-8888"
              defaultValue={ativo ? celularTela(acesso.celular) : sugestao}
            />
          </div>
          </div>
          <div className="acoes">
            <button className="btn btn-primario" type="submit" disabled={gravando}>
              <Smartphone size={16} strokeWidth={1.6} aria-hidden="true" />
              {gravando ? "Gravando…" : ativo ? "Trocar celular" : "Liberar app"}
            </button>
            {ativo && (
              <button className="btn btn-perigo" type="button" disabled={gravando} onClick={revogar}>
                Revogar acesso
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
