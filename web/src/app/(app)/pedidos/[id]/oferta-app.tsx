"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Smartphone } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { CabPainel } from "../../_pessoa/partes";
import { CARROCERIA } from "../../veiculos/rotulos";
import { encerrarOferta, publicarOferta } from "../oferta-actions";

export type OfertaApp = {
  frete_motorista_por_t: number;
  carrocerias: string[] | null;
  eixos_minimos: number | null;
  raio_km: number;
  observacao: string | null;
  publicada_em: string;
};

export type InteressadoApp = { motorista_id: string; motorista_nome: string; km_ate_embarque: number; created_at: string };

type Props = {
  pedidoId: string;
  oferta: OfertaApp | null;
  interessados: InteressadoApp[];
  podeEditar: boolean;
};

const ROT_CARROCERIA = new Map<string, string>(CARROCERIA);
const EIXOS = [5, 6, 7, 9];

/* "App do motorista" no pedido: publica o frete para os motoristas aptos e por perto (eles veem só o frete
   deles) e lista quem disse que tem interesse. O interesse é um aviso: quem contrata é a operação. */
export function OfertaAppPainel({ pedidoId, oferta, interessados, podeEditar }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [vez, setVez] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function publicar(form: FormData) {
    setErro(null);
    iniciar(async () => {
      const r = await publicarOferta(pedidoId, {
        fretePorT: String(form.get("frete") ?? ""),
        carrocerias: form.getAll("carroceria").map(String),
        eixosMinimos: String(form.get("eixos") ?? ""),
        raioKm: String(form.get("raio") ?? ""),
        observacao: String(form.get("observacao") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAberto(false);
      toast(oferta ? "Frete atualizado no app." : "Frete publicado no app do motorista.", "check");
      router.refresh();
    });
  }

  function tirar() {
    setErro(null);
    iniciar(async () => {
      const r = await encerrarOferta(pedidoId);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast("Frete tirado do app.", "check");
      router.refresh();
    });
  }

  const regras = oferta
    ? [
        `${formato.reais(oferta.frete_motorista_por_t)}/t para o motorista`,
        `até ${oferta.raio_km.toLocaleString("pt-BR")} km do embarque`,
        oferta.carrocerias?.length ? oferta.carrocerias.map((c) => ROT_CARROCERIA.get(c) ?? c).join(" ou ") : "qualquer carroceria",
        oferta.eixos_minimos ? `${oferta.eixos_minimos} eixos ou mais` : null,
      ].filter(Boolean)
    : [];

  return (
    <section className="subsecao" aria-label="App do motorista" style={{ marginTop: 32 }}>
      <CabPainel titulo="App do motorista">
        {podeEditar && (
          <>
            {oferta && (
              <button className="btn" type="button" disabled={gravando} onClick={tirar}>
                Tirar do app
              </button>
            )}
            <button
              className="btn btn-primario"
              type="button"
              onClick={() => {
                setErro(null);
                setVez((n) => n + 1);
                setAberto(true);
              }}
            >
              <Smartphone size={16} strokeWidth={1.6} aria-hidden="true" />
              {oferta ? "Mudar o frete no app" : "Publicar no app"}
            </button>
          </>
        )}
      </CabPainel>
      {erro && !aberto && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      {oferta ? (
        <p>
          <Sinal tipo="normal" texto={`No app desde ${formato.dataHora(oferta.publicada_em)}`} /> {regras.join(" · ")}.
          {oferta.observacao && <span className="linha2">{oferta.observacao}</span>}
        </p>
      ) : (
        <p className="nota">
          Fora do app. Publicado, o frete aparece para os motoristas com cadastro aprovado, caminhão sem trava e que avisaram estar livres
          perto da coleta. Eles veem só o frete deles, nunca o da empresa.
        </p>
      )}

      {oferta &&
        (interessados.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve">
              <thead>
                <tr>
                  <th scope="col">Interessado pelo app</th>
                  <th scope="col" className="num">
                    Até o embarque
                  </th>
                  <th scope="col" className="num">
                    Quando
                  </th>
                </tr>
              </thead>
              <tbody>
                {interessados.map((i) => (
                  <tr key={i.motorista_id}>
                    <td>{i.motorista_nome}</td>
                    <td className="num">{i.km_ate_embarque.toLocaleString("pt-BR")} km</td>
                    <td className="num">{formato.dataHora(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="nota">Ninguém disse que tem interesse ainda.</p>
        ))}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={oferta ? "Mudar o frete no app" : "Publicar no app do motorista"}
        onSubmit={(e) => {
          e.preventDefault();
          if (!gravando) publicar(new FormData(e.currentTarget));
        }}
        pe={
          <>
            <button className="btn" type="button" data-fechar disabled={gravando}>
              Voltar
            </button>
            <button className="btn btn-primario" type="submit" disabled={gravando}>
              {gravando ? "Publicando…" : "Publicar"}
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
        <div className="campos" key={vez}>
          <div className="campo f6">
            <label htmlFor="oferta-frete">Frete do motorista (R$/t)</label>
            <input
              id="oferta-frete"
              name="frete"
              className="num"
              inputMode="decimal"
              autoComplete="off"
              required
              defaultValue={oferta ? oferta.frete_motorista_por_t.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
            />
            <span className="ajuda">É o valor que o motorista vê no app. Confira o piso da ANTT na calculadora.</span>
          </div>
          <div className="campo f6">
            <label htmlFor="oferta-raio">Raio de busca (km)</label>
            <input id="oferta-raio" name="raio" className="num" inputMode="numeric" defaultValue={oferta?.raio_km ?? 300} />
            <span className="ajuda">Distância do motorista até a coleta.</span>
          </div>
          <div className="campo f6">
            <label htmlFor="oferta-eixos">Eixos mínimos</label>
            <select id="oferta-eixos" name="eixos" defaultValue={oferta?.eixos_minimos ?? ""}>
              <option value="">Qualquer</option>
              {EIXOS.map((n) => (
                <option key={n} value={n}>
                  {n} eixos ou mais
                </option>
              ))}
            </select>
          </div>
          <fieldset className="campo f12">
            <legend>Carrocerias aceitas</legend>
            <span className="ajuda">Nenhuma marcada = qualquer carroceria.</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "4px 16px" }}>
              {CARROCERIA.map(([k, r]) => (
                <label key={k} className="marcar">
                  <input type="checkbox" name="carroceria" value={k} defaultChecked={oferta?.carrocerias?.includes(k) ?? false} /> {r}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="campo f12">
            <label htmlFor="oferta-obs">
              Recado para o motorista <span className="opcional">(opcional)</span>
            </label>
            <textarea
              id="oferta-obs"
              name="observacao"
              maxLength={500}
              defaultValue={oferta?.observacao ?? ""}
              placeholder="Ex.: carregamento a partir das 7 h, levar lona"
            />
          </div>
        </div>
      </Dialogo>
    </section>
  );
}
