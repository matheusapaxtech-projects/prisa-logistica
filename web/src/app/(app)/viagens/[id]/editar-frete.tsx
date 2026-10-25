"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Pencil } from "lucide-react";
import { Campo } from "@/components/Campo";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import type { Database } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { Opcoes } from "../../_pessoa/partes";
import { TIPOS_TARIFA } from "../../pedidos/regras";
import { salvarFreteViagem } from "../actions";

export type FreteEditavel = {
  viagemId: string;
  numero: number;
  freteMotoristaValor: number | null;
  freteMotoristaTipo: Database["public"]["Enums"]["tipo_tarifa"] | null;
  kmViagem: number | null;
  pedagioValor: number | null;
};

/* "Editar frete" da viagem planejada: frete do motorista, km e pedágio. A ficha recarrega e a aptidão
   (piso da ANTT) é conferida de novo pelo banco. */
export function EditarFrete(props: FreteEditavel) {
  const [aberto, setAberto] = useState(false);
  // Cada abertura é um diálogo novo: sem o erro nem os campos da vez anterior.
  const [vez, setVez] = useState(0);
  return (
    <>
      <button
        className="btn"
        type="button"
        id="btn-editar-frete"
        onClick={() => {
          setVez((n) => n + 1);
          setAberto(true);
        }}
      >
        <Pencil size={16} strokeWidth={1.6} aria-hidden="true" />
        Editar frete
      </button>
      <DialogoFrete key={vez} {...props} aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
  );
}

function DialogoFrete({ viagemId, numero, freteMotoristaValor, freteMotoristaTipo, kmViagem, pedagioValor, aberto, aoFechar }: FreteEditavel & { aberto: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const [estado, enviar, gravando] = useActionState(salvarFreteViagem, null);
  const campos: Record<string, string> = estado && !estado.ok && "campos" in estado ? estado.campos : {};
  const erro = estado && !estado.ok && !("campos" in estado) ? estado.erro : null;

  useEffect(() => {
    if (!estado?.ok) return;
    aoFechar();
    toast(`Frete da viagem #${numero} gravado. A aptidão foi conferida de novo.`, "check");
    router.refresh();
    // `router` e `aoFechar` não disparam: só a resposta nova do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gravando) return;
    const dados = new FormData(e.currentTarget);
    startTransition(() => enviar(dados));
  }

  const descr = (nome: string, ajuda = true) => [ajuda ? `${nome}-ajuda` : "", campos[nome] ? `${nome}-erro` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Frete da viagem #${numero}`}
      className="dlg-viagem"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar disabled={gravando}>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando}>
            {gravando ? "Gravando…" : "Gravar frete"}
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
      <p className="muted">O frete do motorista não pode ficar abaixo do piso da ANTT: a viagem não inicia, nem com exceção.</p>
      <div className="campos">
        <Campo
          classe="f6"
          id="frete_motorista_valor"
          label="Frete do motorista"
          opcional
          erro={campos.frete_motorista_valor}
          controle={
            <span className="prefixo">
              <span aria-hidden="true">R$</span>
              <input
                id="frete_motorista_valor"
                name="frete_motorista_valor"
                className="num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                defaultValue={formato.numeroCampo(freteMotoristaValor, 2)}
                aria-describedby={descr("frete_motorista_valor", false)}
                aria-invalid={campos.frete_motorista_valor ? true : undefined}
              />
            </span>
          }
        />
        <Campo
          classe="f6"
          id="frete_motorista_tipo"
          label="O valor é"
          erro={campos.frete_motorista_tipo}
          controle={
            <select id="frete_motorista_tipo" name="frete_motorista_tipo" defaultValue={freteMotoristaTipo ?? "por_tonelada"}>
              <Opcoes mapa={TIPOS_TARIFA} />
            </select>
          }
        />
        <Campo
          classe="f6"
          id="km_viagem"
          label="Km da viagem"
          opcional
          ajuda="Conferidos no Qualp."
          erro={campos.km_viagem}
          controle={
            <span className="sufixo">
              <input
                id="km_viagem"
                name="km_viagem"
                className="num"
                inputMode="numeric"
                autoComplete="off"
                placeholder="755"
                defaultValue={formato.numeroCampo(kmViagem, 0)}
                aria-describedby={descr("km_viagem")}
                aria-invalid={campos.km_viagem ? true : undefined}
              />
              <span aria-hidden="true">km</span>
            </span>
          }
        />
        <Campo
          classe="f6"
          id="pedagio_valor"
          label="Pedágio da viagem"
          opcional
          ajuda="Total do vale-pedágio."
          erro={campos.pedagio_valor}
          controle={
            <span className="prefixo">
              <span aria-hidden="true">R$</span>
              <input
                id="pedagio_valor"
                name="pedagio_valor"
                className="num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                defaultValue={formato.numeroCampo(pedagioValor, 2)}
                aria-describedby={descr("pedagio_valor")}
                aria-invalid={campos.pedagio_valor ? true : undefined}
              />
            </span>
          }
        />
      </div>
      {/* Por último: o Dialogo põe o foco no primeiro input da caixa. */}
      <input type="hidden" name="viagem_id" value={viagemId} />
    </Dialogo>
  );
}
