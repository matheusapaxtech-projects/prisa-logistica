"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { UserCheck } from "lucide-react";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { acharMunicipio, dataBr, lerMunicipios, type Municipios } from "@/lib/calculadora/rota";
import { formato } from "@/lib/formato";
import { CabSecao } from "../calculadora/partes";
import { encerrarDisponibilidade, registrarDisponibilidade } from "./actions";

/* Tela "Motoristas livres": registrar o que o motorista avisou e ver quem está livre agora. */

export type Livre = {
  id: string;
  motorista: string;
  cidade: string;
  livreAte: string;
  registradoEm: string;
  observacao: string | null;
  viagens: number;
  vigente: boolean;
};

export type OpcaoMotorista = { id: string; nome: string; placa: string; eixos: number | null; capacidadeT: number | null };

const PRAZOS = [
  [12, "12 horas"],
  [24, "24 horas"],
  [48, "2 dias"],
  [72, "3 dias"],
] as const;

export function DisponiveisCliente({ livres, motoristas, podeEditar }: { livres: Livre[]; motoristas: OpcaoMotorista[]; podeEditar: boolean }) {
  const [mun, setMun] = useState<Municipios | null>(null);
  const [motorista, setMotorista] = useState("");
  const [cidade, setCidade] = useState("");
  const [horas, setHoras] = useState(24);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const [encerrando, setEncerrando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    import("@/lib/calculadora/municipios-dados").then((m) => vivo && setMun(lerMunicipios(m.MUNICIPIOS_RAW)));
    return () => {
      vivo = false;
    };
  }, []);

  const busca = useMemo(() => (mun && cidade.trim() ? acharMunicipio(mun, cidade) : null), [mun, cidade]);
  const datalist = useMemo(
    () =>
      mun ? (
        <datalist id="municipios">
          {mun.lista.map((m) => (
            <option key={m.nome} value={m.nome} />
          ))}
        </datalist>
      ) : null,
    [mun],
  );

  function registrar() {
    setErro(null);
    if (!motorista) return setErro("Escolha o motorista.");
    const m = busca?.municipio;
    if (!m) return setErro(busca && busca.ambiguos > 1 ? "Há mais de uma cidade com esse nome: escolha a da UF certa na lista." : "Escolha a cidade na lista.");
    iniciar(async () => {
      const r = await registrarDisponibilidade({ motoristaId: motorista, cidade: m.nome, lat: m.lat, lon: m.lon, horas, observacao: obs });
      if (!r.ok) return setErro(r.erro);
      toast("Disponibilidade registrada.");
      setMotorista("");
      setCidade("");
      setObs("");
    });
  }

  function encerrar(id: string) {
    setEncerrando(id);
    iniciar(async () => {
      const r = await encerrarDisponibilidade(id);
      setEncerrando(null);
      toast(r.ok ? "Disponibilidade encerrada." : r.erro, r.ok ? "check" : "alert-circle");
    });
  }

  const vigentes = livres.filter((l) => l.vigente);
  const vencidas = livres.filter((l) => !l.vigente);

  return (
    <>
      <div className="titulo">
        <div>
          <h1>Motoristas livres</h1>
          <p className="sub">Quem avisou que está livre para carregar. O despacho do pedido usa esta lista no ranking dos motoristas.</p>
        </div>
      </div>
      {datalist}
      <div className="calc-grade">
        <div className="calc-entradas">
          <section className="painel" aria-labelledby="disp-agora">
            <CabSecao id="disp-agora" titulo={`Livres agora (${vigentes.length})`} />
            {vigentes.length === 0 ? (
              <p className="calc-vazio">Ninguém livre agora. Registre ao lado quando um motorista avisar.</p>
            ) : (
              <Tabela linhas={vigentes} podeEditar={podeEditar} encerrar={encerrar} encerrando={encerrando} />
            )}
          </section>
          {vencidas.length > 0 && (
            <details className="painel disp-vencidas">
              <summary>Disponibilidades vencidas ({vencidas.length})</summary>
              <Tabela linhas={vencidas} podeEditar={false} encerrar={encerrar} encerrando={encerrando} />
            </details>
          )}
        </div>
        {podeEditar && (
          <aside className="calc-lateral">
            <section className="painel" aria-labelledby="disp-registrar">
              <CabSecao id="disp-registrar" titulo="Registrar motorista livre">
                Onde ele está agora e até quando pode carregar.
              </CabSecao>
              {erro && (
                <p className="aviso aviso-bloqueado" role="alert">
                  {erro}
                </p>
              )}
              <div className="campos">
                <div className="campo f12">
                  <label htmlFor="disp-motorista">Motorista</label>
                  <select id="disp-motorista" value={motorista} onChange={(e) => setMotorista(e.target.value)}>
                    <option value="">Escolha…</option>
                    {motoristas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} · {m.placa}
                        {m.eixos ? ` · ${m.eixos} eixos` : ""}
                        {m.capacidadeT ? ` · ${m.capacidadeT.toLocaleString("pt-BR")} t` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="ajuda">Só motoristas de conjuntos abertos.</span>
                </div>
                <div className="campo f12">
                  <label htmlFor="disp-cidade">Está em</label>
                  <input id="disp-cidade" list="municipios" autoComplete="off" placeholder="Digite a cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div className="campo f12">
                  <span className="rotulo" id="disp-prazo">
                    Livre por
                  </span>
                  <div className="calc-opcoes" role="group" aria-labelledby="disp-prazo">
                    {PRAZOS.map(([h, r]) => (
                      <button key={h} type="button" aria-pressed={horas === h} onClick={() => setHoras(h)}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="campo f12">
                  <label htmlFor="disp-obs">
                    Observação <span className="opcional">(opcional)</span>
                  </label>
                  <input id="disp-obs" maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: prefere voltar para o PR" />
                </div>
              </div>
              <button type="button" className="btn btn-primario disp-registrar" disabled={gravando} onClick={registrar}>
                <UserCheck size={16} strokeWidth={1.6} aria-hidden="true" />
                {gravando && !encerrando ? "Registrando…" : "Registrar"}
              </button>
            </section>
          </aside>
        )}
      </div>
    </>
  );
}

function Tabela({
  linhas,
  podeEditar,
  encerrar,
  encerrando,
}: {
  linhas: Livre[];
  podeEditar: boolean;
  encerrar: (id: string) => void;
  encerrando: string | null;
}) {
  const hora = (iso: string) => formato.dataHora(iso);
  return (
    <div className="tabela-wrap">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Motorista</th>
            <th scope="col">Está em</th>
            <th scope="col">Livre até</th>
            <th scope="col">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <td>
                <span className="id">{l.motorista}</span>
                <span className="linha2">
                  avisou em {dataBr(l.registradoEm)} · {l.viagens ? `${l.viagens} viagens com a Prisa` : "sem histórico com a Prisa"}
                  {l.observacao ? ` · ${l.observacao}` : ""}
                </span>
              </td>
              <td>{l.cidade}</td>
              <td>{l.vigente ? hora(l.livreAte) : <Sinal tipo="neutro" texto={`venceu em ${hora(l.livreAte)}`} />}</td>
              <td className="num">
                {podeEditar && l.vigente && (
                  <button type="button" className="calc-link calc-link-perigo" disabled={encerrando === l.id} onClick={() => encerrar(l.id)}>
                    {encerrando === l.id ? "Encerrando…" : "Encerrar"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
