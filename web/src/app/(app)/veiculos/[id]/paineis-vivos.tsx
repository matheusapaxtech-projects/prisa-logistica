"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formato } from "@/lib/formato";
import { BlocoDonos } from "../dono";
import type { OpcaoPessoa } from "../pessoas-tipos";
import { ASSOALHO, RECEBEDOR, num, type CategoriaVeiculo, type SituacaoOperacional } from "../rotulos";
import { SeletorPessoa } from "../seletor-pessoa";
import { CampoNumero, Radios, Secao, type Erros } from "./campos-ficha";
import type { VeiculoFicha } from "./tipos";

/* Abas que reagem ao que se digita antes de salvar: Proprietários (cartões de posse e ANTT) e
   Características (capacidade calculada e réguas de peso). O estado vem de `FichaForm`. */

/* ---------- Proprietários ---------- */
export type PropsProprietarios = {
  erros: Erros;
  v: VeiculoFicha;
  posse: OpcaoPessoa | null;
  documento: OpcaoPessoa | null;
  motorista: OpcaoPessoa | null;
  aoPosse: (o: OpcaoPessoa | null) => void;
  aoDocumento: (o: OpcaoPessoa | null) => void;
  aoMotorista: (o: OpcaoPessoa | null) => void;
  contrato: { nome: string; validade: string | null } | null;
  situacaoOperacional: SituacaoOperacional;
  verDocumentosHref: string;
  anexarHref: string | null;
};

export function PainelProprietarios(p: PropsProprietarios) {
  return (
    <>
      <BlocoDonos
        posse={p.posse}
        antt={p.documento}
        contrato={p.contrato}
        situacaoOperacional={p.situacaoOperacional}
        verDocumentosHref={p.verDocumentosHref}
        anexarHref={p.anexarHref}
      />
      <Secao
        id="s-donos"
        titulo="Quem é dono"
        texto={
          <>
            <p>
              A posse é o nome no CRLV. O documento é quem está na ANTT e sai impresso no CT-e. Quando são diferentes, o veículo é
              arrendado.
            </p>
            <p className="small">
              <Link href="/proprietarios/novo">Cadastrar proprietário novo</Link>
            </p>
          </>
        }
      >
        <div className="campo f6" data-invalido={p.erros.proprietario_posse_id ? "" : undefined}>
          <label htmlFor="proprietario_posse_id">Proprietário da posse (CRLV)</label>
          <SeletorPessoa
            id="proprietario_posse_id"
            nome="proprietario_posse_id"
            tipo="proprietario"
            valor={p.posse}
            aoMudar={p.aoPosse}
            invalido={!!p.erros.proprietario_posse_id}
            descritoPor={p.erros.proprietario_posse_id ? "proprietario_posse_id-erro" : undefined}
          />
          {p.erros.proprietario_posse_id && (
            <span className="erro" id="proprietario_posse_id-erro">
              {p.erros.proprietario_posse_id}
            </span>
          )}
        </div>
        <div className="campo f6" data-invalido={p.erros.proprietario_documento_id ? "" : undefined}>
          <label htmlFor="proprietario_documento_id">Proprietário do documento (ANTT)</label>
          <SeletorPessoa
            id="proprietario_documento_id"
            nome="proprietario_documento_id"
            tipo="proprietario"
            valor={p.documento}
            aoMudar={p.aoDocumento}
            invalido={!!p.erros.proprietario_documento_id}
            descritoPor={p.erros.proprietario_documento_id ? "proprietario_documento_id-erro" : undefined}
          />
          {p.erros.proprietario_documento_id && (
            <span className="erro" id="proprietario_documento_id-erro">
              {p.erros.proprietario_documento_id}
            </span>
          )}
        </div>
      </Secao>
      <Secao id="s-pgto" titulo="Pagamento e motorista" texto={<p>Quem recebe os valores do frete deste veículo e quem dirigiu por último.</p>}>
        <Radios nome="recebedor_valores" rotulo="Recebedor de valores" opcoes={RECEBEDOR} valor={p.v.recebedor_valores ?? ""} erros={p.erros} />
        <div className="campo f6" data-invalido={p.erros.ultimo_motorista_id ? "" : undefined}>
          <label htmlFor="ultimo_motorista_id">
            Último motorista <span className="opcional">(opcional)</span>
          </label>
          <SeletorPessoa
            id="ultimo_motorista_id"
            nome="ultimo_motorista_id"
            tipo="motorista"
            valor={p.motorista}
            aoMudar={p.aoMotorista}
            placeholder="Nenhum ainda"
            limpavel
          />
          {p.erros.ultimo_motorista_id && <span className="erro">{p.erros.ultimo_motorista_id}</span>}
        </div>
      </Secao>
    </>
  );
}

/* ---------- Características e capacidade ---------- */
export type Foto = {
  pbt: number | null;
  tara: number | null;
  cmt: number | null;
  /** "Calcular pelo PBT e tara" marcado: a capacidade não é gravada, o banco calcula. */
  auto: boolean;
  cap: number | null;
};

type Segmento = { v: number; cls: string; rot: string };

/** Régua em escala (`regua` do protótipo): barras lado a lado, marcas de 5 em 5 (10 em 10 acima de 60 t). */
function Regua({ escala, segs, fim, rotulo }: { escala: number; segs: Segmento[]; fim: ReactNode; rotulo: string }) {
  if (!escala) return null;
  const passo = escala > 60 ? 10 : 5;
  const visiveis = segs.filter((s) => s.v > 0);
  const barras = visiveis.map((s, i) => {
    const left = visiveis.slice(0, i).reduce((a, o) => a + (o.v / escala) * 100, 0);
    return <i key={s.cls} className={`seg ${s.cls}`} style={{ left: `${left}%`, width: `${(s.v / escala) * 100}%` }} />;
  });
  const marcas: ReactNode[] = [];
  for (let t = 0; t <= escala + 0.01; t += passo) marcas.push(<span key={t} style={{ left: `${(t / escala) * 100}%` }}>{t}</span>);
  return (
    <div className="balanca" role="img" aria-label={rotulo}>
      <div className="balanca-trilho">{barras}</div>
      <div className="balanca-regua" aria-hidden="true">
        {marcas}
      </div>
      <div className="balanca-legenda">
        {segs.map((s) => (
          <span key={s.cls}>
            <i className={`seg-chave ${s.cls}`} />
            {s.rot} <b>{formato.t(s.v)}</b>
          </span>
        ))}
        <span className="fim">{fim}</span>
      </div>
    </div>
  );
}

const arred = (n: number) => +n.toFixed(1);

export function PainelCaracteristicas({
  v,
  erros,
  categoria,
  foto,
  taraPecas,
  daqui,
}: {
  v: VeiculoFicha;
  erros: Erros;
  categoria: CategoriaVeiculo;
  foto: Foto;
  /** Tara das outras peças do conjunto aberto do cavalo (nulo = cavalo livre). */
  taraPecas: number | null;
  /** Valor inicial do campo de capacidade (informada, ou calculada). */
  daqui: number | null;
}) {
  const ehCavalo = categoria === "cavalo";
  const ehDolly = categoria === "dolly";
  const { pbt, tara, cmt, auto, cap } = foto;
  const calc = pbt != null && tara != null ? arred(pbt - tara) : null;

  const explicacao =
    pbt == null || tara == null ? (
      "Informe PBT e tara para ver a capacidade."
    ) : auto ? (
      <>
        Calculada: PBT {formato.t(pbt)} menos tara {formato.t(tara)} dá <b>{formato.t(calc)}</b>.
      </>
    ) : cap == null ? (
      "Informe a capacidade ou volte a calcular."
    ) : (
      <>
        Informada à mão: <b>{formato.t(cap)}</b>. Pelo PBT e tara daria {formato.t(calc)}
        {cap + tara > pbt + 0.05 && (
          <>
            ; <span className="passa">tara mais capacidade passa do PBT em {formato.t(arred(cap + tara - pbt))}</span>
          </>
        )}
        .
      </>
    );

  const reguas: ReactNode[] = [];
  if (pbt != null && tara != null) {
    const c = cap ?? 0;
    const sobra = Math.max(0, pbt - tara - c);
    const exc = Math.max(0, tara + c - pbt);
    const segs: Segmento[] = [
      { v: tara, cls: "tara", rot: "Tara" },
      { v: Math.min(c, Math.max(0, pbt - tara)), cls: ehDolly ? "neutra" : "carga", rot: ehCavalo ? "Na quinta roda" : "Capacidade" },
    ];
    if (sobra > 0.05) segs.push({ v: arred(sobra), cls: "livre", rot: "Sem uso" });
    if (exc > 0.05) segs.push({ v: arred(exc), cls: "excede", rot: "Passa do PBT" });
    reguas.push(
      <Regua
        key="pbt"
        escala={Math.max(pbt, tara + c)}
        segs={segs}
        fim={
          <>
            PBT <b>{formato.t(pbt)}</b>
          </>
        }
        rotulo={`PBT ${formato.t(pbt)}: tara ${formato.t(tara)} e capacidade ${formato.t(c)}`}
      />,
    );
  }
  if (ehCavalo && cmt != null && tara != null) {
    const segs: Segmento[] = [{ v: tara, cls: "tara", rot: "Tara do cavalo" }];
    if (taraPecas != null) segs.push({ v: taraPecas, cls: "tara-pecas", rot: "Tara das peças engatadas" });
    segs.push({
      v: arred(Math.max(0, cmt - tara - (taraPecas ?? 0))),
      cls: "carga",
      rot: taraPecas != null ? "Cabe de carga" : "Sobra para peças e carga",
    });
    reguas.push(
      <div key="cmt">
        <h3 className="balanca-tit">CMT {taraPecas != null ? "com o conjunto atual" : "do cavalo"}</h3>
        <Regua
          escala={cmt}
          segs={segs}
          fim={
            <>
              CMT <b>{formato.t(cmt)}</b>
            </>
          }
          rotulo={`CMT ${formato.t(cmt)}`}
        />
      </div>,
    );
  }

  const medidas = !ehCavalo && !ehDolly;
  const texto = ehCavalo ? (
    <p>
      No cavalo, PBT menos tara é o peso que a quinta roda aguenta. A carga do conjunto é conferida pelo CMT: cavalo, carretas, dolly e
      carga juntos não passam dele.
    </p>
  ) : ehDolly ? (
    <p>O dolly liga duas carretas e não leva carga: a capacidade dele não entra na conta do conjunto, só a tara.</p>
  ) : (
    <p>
      Capacidade de carga é o PBT menos a tara. O NILT calcula sozinho; desmarque o cálculo para usar o número do documento do
      implemento.
    </p>
  );

  return (
    <>
      <Secao
        id="s-med"
        titulo="Medidas"
        texto={<p>{medidas ? "Do implemento, em metros. O assoalho diz que carga ele aceita." : "Do veículo, em metros, como no manual do fabricante."}</p>}
      >
        {medidas && <Radios nome="tipo_assoalho" rotulo="Tipo de assoalho" opcoes={ASSOALHO} valor={v.tipo_assoalho ?? ""} erros={erros} />}
        <CampoNumero nome="comprimento_m" classe="f4" rotulo="Comprimento (m)" valor={v.comprimento_m} casas={2} erros={erros} opcional />
        <CampoNumero nome="largura_m" classe="f4" rotulo="Largura (m)" valor={v.largura_m} casas={2} erros={erros} opcional />
        <CampoNumero nome="altura_m" classe="f4" rotulo="Altura (m)" valor={v.altura_m} casas={2} erros={erros} opcional />
      </Secao>
      <Secao id="s-peso" titulo="Peso e capacidade" texto={texto}>
        <CampoNumero nome="pbt_t" classe="f3" rotulo="PBT (t)" valor={v.pbt_t} erros={erros} />
        <CampoNumero nome="tara_t" classe="f3" rotulo="Tara (t)" valor={v.tara_t} erros={erros} />
        <div className="campo f3" data-invalido={erros.capacidade_carga_t ? "" : undefined}>
          <label htmlFor="capacidade_carga_t">Capacidade de carga (t)</label>
          <input
            id="capacidade_carga_t"
            name="capacidade_carga_t"
            className="num"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={num(daqui)}
            readOnly={auto}
            aria-invalid={erros.capacidade_carga_t ? true : undefined}
            aria-describedby={erros.capacidade_carga_t ? "capacidade_carga_t-erro" : undefined}
          />
          <label className="marcar">
            <input type="checkbox" id="cap_auto" name="cap_auto" defaultChecked={v.capacidade_carga_t == null} />
            <span>Calcular pelo PBT e tara</span>
          </label>
          {erros.capacidade_carga_t && (
            <span className="erro" id="capacidade_carga_t-erro">
              {erros.capacidade_carga_t}
            </span>
          )}
        </div>
        {ehCavalo ? (
          <CampoNumero nome="cmt_t" classe="f3" rotulo="CMT (t)" valor={v.cmt_t} erros={erros} ajuda="Capacidade máxima de tração, do CRLV." />
        ) : (
          <div className="f3" />
        )}
        <p className="f12 cap-expl" id="cap-expl" aria-live="polite">
          {explicacao}
        </p>
        <div className="f12" id="balancas">
          {reguas.length ? reguas : <div className="vazio-bloco">Sem PBT e tara não há o que desenhar.</div>}
        </div>
      </Secao>
    </>
  );
}
