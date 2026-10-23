import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2, FileUp, Link2, Paperclip } from "lucide-react";
import { Abas } from "@/components/Abas";
import { Documentos } from "@/components/Documentos";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Historico } from "@/components/Historico";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import "@/styles/paginas/veiculos.css";
import { opcoesPorId } from "../pessoas";
import { ehId } from "../schema";
import { marcaCurta, rotuloSituacaoCadastro, rotuloTipo } from "../rotulos";
import { AvisoCriado } from "./aviso-criado";
import {
  arquivoEnviado,
  capacidadeDoConjunto,
  carregarVeiculo,
  conjuntoAberto,
  conjuntosDoVeiculo,
  listarArquivos,
  type ArquivoResumo,
} from "./consultas";
import { FichaForm } from "./ficha-form";
import { PainelConjunto } from "./painel-conjunto";

type Busca = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const f = ehId(id) ? await carregarVeiculo(id) : null;
  return { title: f ? `${f.v.placa} · Veículos` : "Veículo não encontrado" };
}

type Pendencia = [TipoSinal, string];

/** O que pede atenção neste veículo (`pendencias()` do protótipo), na ordem em que aparecem no cabeçalho. */
function pendenciasDo(
  arrendado: boolean,
  { contratoEnviado, crlvEnviado }: { contratoEnviado: boolean; crlvEnviado: boolean },
  arquivos: ArquivoResumo[],
  seguroValidade: string | null,
): Pendencia[] {
  const l: Pendencia[] = [];
  if (arrendado && !contratoEnviado) l.push(["pendente", "Sem contrato de arrendamento"]);
  arquivos.filter((a) => a.validade && diasAte(a.validade) < 0).forEach((a) => l.push(["bloqueado", `${a.tipo} vencido`]));
  if (!crlvEnviado) l.push(["pendente", "CRLV não anexado"]);
  if (seguroValidade) {
    const s = diasAte(seguroValidade);
    if (s < 0) l.push(["bloqueado", "Seguro vencido"]);
    else if (s <= 30) l.push(["vencendo", `Seguro ${formato.dias(s)}`]);
  }
  return l;
}

const TIPOS_ARQUIVO_VEICULO = ["CRLV", "CONTRATO", "CRV / DUT", "ANTT", "FOTO", "FOTO CONJUNTO", "OUTROS"];

export default async function FichaVeiculo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Busca> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!ehId(id)) notFound();
  const ficha = await carregarVeiculo(id);
  if (!ficha) notFound();
  const { v, tipo, marca } = ficha;

  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const admin = pode(perfil, "admin");
  const categoria = tipo.categoria;
  const arrendado = !!v.arrendado;
  const ehCavalo = categoria === "cavalo";
  const engata = categoria === "cavalo" || categoria === "carreta" || categoria === "dolly";

  const abas = [
    { id: "crlv", rotulo: "CRLV" },
    { id: "proprietarios", rotulo: "Proprietários" },
    { id: "caracteristicas", rotulo: "Características" },
    { id: "tag", rotulo: "TAG e seguro" },
    { id: "rastreamento", rotulo: "Rastreamento" },
    { id: "frota", rotulo: "Frota" },
    { id: "arquivos", rotulo: "Documentos" },
    ...(engata ? [{ id: "conjunto", rotulo: "Conjunto" }] : []),
    ...(admin ? [{ id: "historico", rotulo: "Histórico" }] : []),
  ];
  const abaPedida = typeof sp.aba === "string" ? sp.aba : "";
  const ativa = abas.some((a) => a.id === abaPedida) ? abaPedida : "crlv";

  const db = tipado(await createClient());
  const [arquivos, contratoEnviado, crlvEnviado, abertoId, donos, motoristas] = await Promise.all([
    listarArquivos(db, id),
    arquivoEnviado(db, id, "CONTRATO"),
    arquivoEnviado(db, id, "CRLV"),
    engata ? conjuntoAberto(db, id) : Promise.resolve(null),
    opcoesPorId(db, "proprietario", [v.proprietario_posse_id, v.proprietario_documento_id]),
    opcoesPorId(db, "motorista", [v.ultimo_motorista_id]),
  ]);
  const comCapacidade = ehCavalo && abertoId ? await capacidadeDoConjunto(db, abertoId) : null;
  const taraPecas = comCapacidade && v.tara_t != null ? Math.round((comCapacidade.tara_total_t - v.tara_t) * 10) / 10 : comCapacidade ? comCapacidade.tara_total_t : null;

  // Listas de apoio da ficha (só quando as abas de edição estão no formulário).
  const [tipos, marcas, operadoras, unidades] = await Promise.all([
    db.from("tipo_veiculo").select("id, nome, categoria, eixos, configuracao_cavalo").order("nome"),
    db.from("marca_veiculo").select("id, nome").order("nome"),
    db.from("operadora_tag").select("id, nome").order("nome"),
    db.from("unidade_operacional").select("id, nome").order("nome"),
  ]);
  for (const r of [tipos, marcas, operadoras, unidades]) if (r.error) throw r.error;

  const tipoRot = rotuloTipo(tipo);
  const marcaModelo = `${marcaCurta(marca)} ${v.modelo ?? ""}`.trim();
  const anos = v.ano_fabricacao ? `${v.ano_fabricacao}/${v.ano_modelo ?? v.ano_fabricacao}` : "";
  const crlvArq = arquivos.find((a) => a.tipo === "CRLV") ?? null;
  const contratoArq = arquivos.find((a) => a.tipo === "CONTRATO") ?? null;
  const semContrato = arrendado && !contratoEnviado;
  const pendencias = pendenciasDo(arrendado, { contratoEnviado, crlvEnviado }, arquivos, v.seguro_validade);
  const tipoAnexo = typeof sp.tipo === "string" && TIPOS_ARQUIVO_VEICULO.includes(sp.tipo) ? sp.tipo : null;
  const anexarHref = (t: string) => `?aba=arquivos&tipo=${encodeURIComponent(t)}#enviar-documento`;

  // Documentos esperados que ainda não foram anexados
  const esperados: [string, string][] = [["CRLV", "CRLV do exercício"], ...(arrendado ? ([["CONTRATO", "Contrato de arrendamento"]] as [string, string][]) : [])];
  const faltam = esperados.filter(([t]) => !(t === "CRLV" ? crlvEnviado : contratoEnviado));

  const conjuntos = ativa === "conjunto" && engata ? await conjuntosDoVeiculo(db, id) : [];
  const atual = conjuntos.find((c) => c.id === abertoId) ?? null;
  const capacidadeAtual = atual ? (ehCavalo && comCapacidade ? comCapacidade : await capacidadeDoConjunto(db, atual.id)) : null;

  return (
    <main>
      {sp.criado && <AvisoCriado placa={v.placa} envioFalhou={sp.envio === "falhou"} />}

      <div className="titulo cab-veiculo">
        <div className="cab-id">
          <div className="migalha">
            <Link href="/veiculos">Veículos</Link>
            <span className="sep" aria-hidden="true">/</span>
            <h1>
              <Placa placa={v.placa} grande />
              <span className="sr-only"> {tipoRot}</span>
            </h1>
          </div>
          <div className="cab-txt">
            <p className="cab-tipo">
              {tipoRot}
              <Ponto />
              {tipo.eixos} eixos
            </p>
            <p className="cab-modelo">
              {marcaModelo}
              {anos && (
                <>
                  <Ponto />
                  {anos}
                </>
              )}
              {v.cor && (
                <>
                  <Ponto />
                  {v.cor}
                </>
              )}
            </p>
            <div className="sinais" id="sinais">
              <Sinal situacao={v.situacao_cadastro} texto={`Cadastro ${rotuloSituacaoCadastro(v.situacao_cadastro).toLowerCase()}`} />
              {/* "Arrendado" vem só da coluna gerada (posse ≠ ANTT), como a aba Arrendados da lista */}
              {v.situacao_operacional !== "arrendado" && <Sinal situacao={v.situacao_operacional} />}
              {arrendado && <Sinal situacao="arrendado" />}
              {pendencias.slice(0, 2).map(([t, texto]) => (
                <Sinal key={texto} tipo={t} texto={texto} />
              ))}
            </div>
          </div>
        </div>
        <div className="acoes">
          {engata && abertoId && (
            <Link className="btn" href={`/conjuntos/${abertoId}`}>
              <Link2 size={16} strokeWidth={1.6} />
              Ver conjunto
            </Link>
          )}
          {engata && !abertoId && ehCavalo && podeEditar && (
            <Link className="btn" href={`/conjuntos/novo?cavalo=${v.id}`}>
              <Link2 size={16} strokeWidth={1.6} />
              Montar conjunto
            </Link>
          )}
          {podeEditar && (
            <Link className="btn btn-primario" href={anexarHref(semContrato ? "CONTRATO" : "CRLV")} id="acao-principal">
              {semContrato ? <FileUp size={16} strokeWidth={1.6} /> : <Paperclip size={16} strokeWidth={1.6} />}
              {semContrato ? "Anexar contrato" : "Anexar documento"}
            </Link>
          )}
        </div>
      </div>

      <Abas abas={abas.map((a) => (a.id === "arquivos" ? { ...a, n: arquivos.length } : a))} ativa={ativa} rotulo="Partes da ficha" />

      <FichaForm
        v={v}
        ativa={ativa}
        tipos={tipos.data ?? []}
        marcas={marcas.data ?? []}
        operadoras={operadoras.data ?? []}
        unidades={unidades.data ?? []}
        tipo={tipo}
        posse={donos.get(v.proprietario_posse_id) ?? null}
        documento={donos.get(v.proprietario_documento_id) ?? null}
        motorista={v.ultimo_motorista_id ? (motoristas.get(v.ultimo_motorista_id) ?? null) : null}
        crlv={crlvEnviado ? { nome: crlvArq?.nome ?? "CRLV (restrito)", validade: crlvArq?.validade ?? null } : null}
        contrato={contratoEnviado ? { nome: contratoArq?.nome ?? "Contrato de arrendamento", validade: contratoArq?.validade ?? null } : null}
        taraPecas={taraPecas}
        podeEditar={podeEditar}
        verDocumentosHref="?aba=arquivos"
        anexarHref={podeEditar ? anexarHref("CONTRATO") : null}
      />

      {ativa === "arquivos" && (
        <div data-painel="arquivos">
          {faltam.map(([t, rot]) => (
            <EstadoVazio key={t} style={{ marginBottom: 12 }}>
              <FilePlus2 size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>
                <b>{rot}</b> ainda não anexado{t === "CONTRATO" ? ": obrigatório para veículo arrendado" : ""}.
              </span>
              {podeEditar && (
                <Link className="btn btn-texto" href={anexarHref(t)}>
                  Anexar
                </Link>
              )}
            </EstadoVazio>
          ))}
          <Documentos
            veiculoId={id}
            podeEditar={podeEditar}
            titulo="Documentos do veículo"
            vazio="Nenhum arquivo anexado a este veículo."
            tipoSugerido={tipoAnexo ?? (semContrato ? "CONTRATO" : "CRLV")}
            idEnvio="enviar-documento"
          />
        </div>
      )}

      {ativa === "conjunto" && engata && (
        <div data-painel="conjunto">
          <PainelConjunto
            placa={v.placa}
            categoria={categoria}
            atual={atual}
            capacidade={capacidadeAtual}
            anteriores={conjuntos.filter((c) => c.id !== abertoId)}
            podeEditar={podeEditar}
            veiculoId={v.id}
          />
        </div>
      )}

      {ativa === "historico" && admin && (
        <div data-painel="historico">
          <Historico
            tabela="veiculo"
            registroId={id}
            relacionadas={[
              { tabela: "arquivo", coluna: "veiculo_id" },
              { tabela: "conjunto", coluna: "cavalo_id" },
            ]}
            titulo="Histórico de alterações"
            vazio="Nenhuma alteração registrada desde o cadastro."
          />
        </div>
      )}
    </main>
  );
}
