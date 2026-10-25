"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { CircleAlert, Timer } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { salvarLimites } from "./actions";
import type { Limite } from "./consultas";
import { CHAVES_LIMITE, lerLimites } from "./regras";

/* Botão "Tempos-limite" do Quadro (só administrador) e o diálogo: uma linha por chave de `quadro_limite`
   com os minutos do âmbar e do vermelho. A tela confere o que o banco também confere (vermelho maior
   que o âmbar); quem grava é `salvarLimites`, e depois o Quadro recarrega as cores dos cartões. */

type Props = {
  limites: Limite[];
  /** Depois de gravar: recarrega o quadro para as cores usarem os minutos novos. */
  aoSalvar: () => void | Promise<void>;
};

export function TemposLimite(props: Props) {
  const [aberto, setAberto] = useState(false);
  // Cada abertura é um diálogo novo: sem o erro nem os minutos digitados da vez anterior.
  const [vez, setVez] = useState(0);
  return (
    <>
      <button
        className="btn"
        type="button"
        onClick={() => {
          setVez((n) => n + 1);
          setAberto(true);
        }}
      >
        <Timer size={16} strokeWidth={1.6} aria-hidden="true" />
        Tempos-limite
      </button>
      <DialogoLimites key={vez} {...props} aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
  );
}

function DialogoLimites({ limites, aoSalvar, aberto, aoFechar }: Props & { aberto: boolean; aoFechar: () => void }) {
  const [estado, enviar, gravando] = useActionState(salvarLimites, null);
  const [local, setLocal] = useState<{ erro: string; chave?: string } | null>(null);
  const atuais = new Map(limites.map((l) => [l.chave, l]));
  const erroDoServidor = estado && !estado.ok ? estado.erro : null;
  const erro = local?.erro ?? erroDoServidor;
  const salvo = estado?.ok ?? false;

  useEffect(() => {
    if (!salvo) return;
    toast("Tempos-limite salvos.", "check");
    aoFechar();
    void aoSalvar();
    // Só a resposta nova do servidor dispara (as funções mudam a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvo]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    // Envio manual: o React não limpa os campos depois da action.
    e.preventDefault();
    if (gravando || salvo) return;
    const dados = new FormData(e.currentTarget);
    const v = lerLimites(dados);
    if (!v.ok) return setLocal({ erro: v.erro, chave: v.chave });
    setLocal(null);
    startTransition(() => enviar(dados));
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Tempos-limite"
      className="dlg-limites"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar disabled={gravando}>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando || salvo}>
            {gravando ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      <p className="muted">
        Quanto tempo o cartão pode ficar em cada coluna antes de ficar âmbar e depois vermelho, em minutos. O vermelho precisa ser maior que o âmbar.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Coluna</th>
            <th scope="col">Âmbar (min)</th>
            <th scope="col">Vermelho (min)</th>
          </tr>
        </thead>
        <tbody>
          {CHAVES_LIMITE.map(({ chave, rotulo }) => {
            const invalido = local?.chave === chave;
            return (
              <tr key={chave}>
                <th scope="row">{rotulo}</th>
                {(["ambar", "vermelho"] as const).map((qual) => (
                  <td key={qual}>
                    <div className="campo" data-invalido={invalido ? "" : undefined}>
                      <input
                        name={`${qual}_${chave}`}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={`${rotulo}: ${qual === "ambar" ? "âmbar" : "vermelho"}`}
                        aria-invalid={invalido ? true : undefined}
                        defaultValue={atuais.get(chave)?.[qual === "ambar" ? "minutos_ambar" : "minutos_vermelho"]}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Dialogo>
  );
}
