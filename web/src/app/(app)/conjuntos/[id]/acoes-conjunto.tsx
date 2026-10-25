"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CircleAlert, Unlink, UserRoundPen } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { aprovarConjunto } from "../../despacho/actions";
import { trocarMotorista } from "../actions";
import { avisosMotorista } from "../avisos";
import { DialogoEncerrar, type ConjuntoEncerrar } from "../dialogo-encerrar";
import type { MotoristaOpcao } from "../regras";

/** Evento do botão "Escolher motorista" do bloco Motorista (fica longe dos botões do título). */
const EVENTO_ESCOLHER = "nilt:escolher-motorista";

export type DadosAcoes = {
  id: string;
  nome: string;
  /** Base é truck (caminhão): roda sozinho, sem "Trocar peças". */
  truck: boolean;
  motoristaId: string | null;
  motoristaNome: string | null;
  motoristas: MotoristaOpcao[];
  /** Outros conjuntos abertos: motorista → { id, nome } (aviso "já dirige o conjunto…"). */
  dirige: Record<string, { id: string; nome: string }>;
};

/** "Aprovar conjunto": documentos conferidos, o conjunto pode ser contratado (migration 20261030000200). */
export function AprovarConjunto({ id }: { id: string }) {
  const router = useRouter();
  const [gravando, iniciar] = useTransition();
  return (
    <button
      type="button"
      className="btn"
      disabled={gravando}
      onClick={() =>
        iniciar(async () => {
          const r = await aprovarConjunto(id, true);
          if (!r.ok) return toast(r.erro, "alert-circle");
          toast("Conjunto aprovado. Ele já pode ser contratado no Despacho.");
          router.refresh();
        })
      }
    >
      {gravando ? "Aprovando…" : "Aprovar conjunto"}
    </button>
  );
}

/* Botões do conjunto aberto (`renderVer` de prototipo/conjunto.html): Trocar motorista, Trocar peças
   (montador em `?editar=1`) e Encerrar conjunto, com os diálogos. */
export function AcoesConjunto({ d }: { d: DadosAcoes }) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  const [encerrar, setEncerrar] = useState<ConjuntoEncerrar | null>(null);

  useEffect(() => {
    const abrir = () => setTrocando(true);
    window.addEventListener(EVENTO_ESCOLHER, abrir);
    return () => window.removeEventListener(EVENTO_ESCOLHER, abrir);
  }, []);

  return (
    <>
      <div className="acoes">
        <button className="btn" type="button" id="btn-trocar-mot" onClick={() => setTrocando(true)}>
          <UserRoundPen size={16} strokeWidth={1.6} aria-hidden="true" />
          Trocar motorista
        </button>
        {/* truck roda sozinho: não tem peças para trocar */}
        {!d.truck && (
          <Link className="btn" href={`/conjuntos/${d.id}?editar=1`} id="btn-trocar-pecas">
            <ArrowLeftRight size={16} strokeWidth={1.6} aria-hidden="true" />
            Trocar peças
          </Link>
        )}
        <button
          className="btn btn-perigo"
          type="button"
          id="btn-encerrar"
          onClick={() => setEncerrar({ id: d.id, nome: d.nome, motorista: d.motoristaNome })}
        >
          <Unlink size={16} strokeWidth={1.6} aria-hidden="true" />
          Encerrar conjunto
        </button>
      </div>
      <DialogoMotorista key={d.motoristaId ?? ""} d={d} aberto={trocando} aoFechar={() => setTrocando(false)} />
      <DialogoEncerrar
        conjunto={encerrar}
        aoFechar={() => setEncerrar(null)}
        aoEncerrar={() => {
          setEncerrar(null);
          router.refresh();
          document.getElementById("h1")?.focus();
        }}
      />
    </>
  );
}

/** "Escolher motorista" do bloco vazio: abre o mesmo diálogo do "Trocar motorista". */
export function BotaoEscolherMotorista() {
  return (
    <button className="btn btn-texto" type="button" id="btn-escolher-mot" onClick={() => window.dispatchEvent(new Event(EVENTO_ESCOLHER))}>
      Escolher motorista
    </button>
  );
}

function DialogoMotorista({ d, aberto, aoFechar }: { d: DadosAcoes; aberto: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const [sel, setSel] = useState(d.motoristaId ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const m = d.motoristas.find((x) => x.pessoa_id === sel);
  const outro = sel ? d.dirige[sel] : undefined;
  const atualForaDaLista = d.motoristaId && !d.motoristas.some((x) => x.pessoa_id === d.motoristaId);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={() => {
        setSel(d.motoristaId ?? "");
        setErro(null);
        aoFechar();
      }}
      titulo="Trocar motorista"
      onSubmit={(e) => {
        e.preventDefault();
        if (enviando) return;
        if (sel === (d.motoristaId ?? "")) {
          aoFechar();
          return;
        }
        iniciar(async () => {
          const r = await trocarMotorista({ conjuntoId: d.id, motoristaId: sel || null });
          if (!r.ok) {
            setErro(r.erro);
            return;
          }
          setErro(null);
          toast(m ? `Motorista do conjunto agora é ${m.nome}` : "Conjunto ficou sem motorista");
          aoFechar();
          router.refresh();
        });
      }}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={enviando}>
            Trocar motorista
          </button>
        </>
      }
    >
      <p className="muted">Conjunto {d.nome}. Quem estiver nele hoje sai ao confirmar.</p>
      <div className="campo">
        <label htmlFor="dlg-mot-sel">Motorista</label>
        <select id="dlg-mot-sel" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Sem motorista por enquanto</option>
          {atualForaDaLista && <option value={d.motoristaId!}>{d.motoristaNome ?? "Motorista atual"}</option>}
          {d.motoristas.map((x) => (
            <option key={x.pessoa_id} value={x.pessoa_id}>
              {x.nome}, CNH {(x.cnh_categoria ?? "—").toUpperCase()} até {formato.data(x.cnh_validade)}
            </option>
          ))}
        </select>
        <span className="ajuda">Só aparecem motoristas com cadastro normal.</span>
      </div>
      <div className="avisos">{m ? avisosMotorista(m, outro ?? null) : null}</div>
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert" style={{ marginTop: 12 }}>
          <CircleAlert size={18} strokeWidth={1.6} aria-hidden="true" />
          <div>{erro}</div>
        </div>
      )}
    </Dialogo>
  );
}
