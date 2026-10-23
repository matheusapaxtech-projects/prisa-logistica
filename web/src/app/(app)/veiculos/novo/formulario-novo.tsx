"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Check, FileCheck2, FileUp, Info, Lock, Paperclip } from "lucide-react";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { prepararEnvio } from "@/components/documentos-acoes";
import { toast } from "@/components/Toast";
import { TIPOS_ACEITOS, erroDoArquivo, mimeDoArquivo } from "@/lib/arquivos";
import { formato } from "@/lib/formato";
import { createBrowserClient } from "@/lib/supabase/client";
import { validacao } from "@/lib/validacao";
import { consultarPlaca, consultarRenavam, type PlacaExistente } from "../buscas";
import { InfoRntrc } from "../dono";
import type { OpcaoPessoa } from "../pessoas-tipos";
import { CATEGORIAS, UFS, nomeTipoLista, type TipoVeiculo } from "../rotulos";
import { SeletorPessoa } from "../seletor-pessoa";
import { criarVeiculo } from "./actions";
import { estadoPlaca, regraCampo } from "./regras";

type Props = {
  tipos: TipoVeiculo[];
  marcas: { id: number; nome: string }[];
  /** `tipo_arquivo.id` de CONTRATO (para anexar o contrato já na criação). */
  tipoContratoId: number | null;
  /** Só o administrador restringe arquivo; o contrato de quem não é admin entra sem restrição. */
  admin: boolean;
  placaInicial: string;
};

type Valores = {
  tipo_veiculo_id: string;
  renavam: string;
  chassi: string;
  cor: string;
  marca_id: string;
  modelo: string;
  ano_fabricacao: string;
  ano_modelo: string;
  uf_emplacamento: string;
  cidade_emplacamento: string;
};

const VAZIO: Valores = {
  tipo_veiculo_id: "",
  renavam: "",
  chassi: "",
  cor: "",
  marca_id: "",
  modelo: "",
  ano_fabricacao: "",
  ano_modelo: "",
  uf_emplacamento: "PR",
  cidade_emplacamento: "",
};

/** Campos obrigatórios, na ordem da tela, com o nome que a frase "falta" usa. */
const OBRIGATORIOS: [keyof Valores | "proprietario_posse_id", string][] = [
  ["tipo_veiculo_id", "tipo"],
  ["renavam", "Renavam"],
  ["chassi", "chassi"],
  ["marca_id", "marca"],
  ["modelo", "modelo"],
  ["ano_fabricacao", "ano de fabricação"],
  ["ano_modelo", "ano do modelo"],
  ["proprietario_posse_id", "proprietário da posse"],
];

const COM_REGRA = ["renavam", "chassi", "ano_fabricacao", "ano_modelo"] as const;
const soDigitos = validacao.soDigitos;

/** Campo do formulário: rótulo, controle, ajuda e erro (o erro troca a ajuda). */
function CampoNovo({
  id,
  classe,
  rotulo,
  opcional,
  ajuda,
  erro,
  children,
}: {
  id: string;
  classe: string;
  rotulo: ReactNode;
  opcional?: boolean;
  ajuda?: ReactNode;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <div className={`campo ${classe}`} data-invalido={erro ? "" : undefined}>
      <label htmlFor={id}>
        {rotulo}
        {opcional && (
          <>
            {" "}
            <span className="opcional">(opcional)</span>
          </>
        )}
      </label>
      {children}
      {erro ? (
        <span className="erro" id={`${id}-erro`}>
          {erro}
        </span>
      ) : (
        ajuda && (
          <span className="ajuda" id={`${id}-ajuda`}>
            {ajuda}
          </span>
        )
      )}
    </div>
  );
}

export function FormularioNovo({ tipos, marcas, tipoContratoId, admin, placaInicial }: Props) {
  const router = useRouter();
  const [placaBruta, setPlacaBruta] = useState(placaInicial);
  const [existente, setExistente] = useState<PlacaExistente | null>(null);
  const [conferida, setConferida] = useState<string | null>(null); // placa cuja consulta já voltou
  const [v, setV] = useState<Valores>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [renavamEmUso, setRenavamEmUso] = useState<{ renavam: string; placa: string } | null>(null);
  const [posse, setPosse] = useState<OpcaoPessoa | null>(null);
  const [documento, setDocumento] = useState<OpcaoPessoa | null>(null);
  const [contrato, setContrato] = useState<File | null>(null);
  const [erroContrato, setErroContrato] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const campoContrato = useRef<HTMLInputElement>(null);
  const ultimaPlaca = useRef("");

  const p = estadoPlaca(placaBruta);
  const placaLivre = p.completa && conferida === p.placa && !existente;
  const conferindo = p.completa && conferida !== p.placa;
  const liberado = placaLivre;
  const tipo = tipos.find((t) => String(t.id) === v.tipo_veiculo_id) ?? null;
  const anoAtual = new Date().getFullYear();

  const ctx = (renavam: string) => ({
    anoAtual,
    anoFabricacao: v.ano_fabricacao,
    renavamEmUso: renavamEmUso && renavamEmUso.renavam === renavam ? renavamEmUso.placa : null,
  });

  /* ---------- placa: consulta no servidor quando completa e válida ---------- */
  useEffect(() => {
    ultimaPlaca.current = p.completa ? p.placa : "";
    if (!p.completa) return;
    const alvo = p.placa;
    let vigente = true;
    consultarPlaca(alvo).then((r) => {
      if (!vigente || ultimaPlaca.current !== alvo) return;
      setExistente(r.ok ? r.dados : null);
      setConferida(alvo);
      if (!r.ok) setErroGeral(r.erro);
    });
    return () => {
      vigente = false;
    };
  }, [p.completa, p.placa]);

  function aoDigitarPlaca(valor: string) {
    const novo = estadoPlaca(valor).placa;
    if (novo !== p.placa) {
      setExistente(null);
      setConferida(null);
    }
    setPlacaBruta(novo);
  }

  /* ---------- campos ---------- */
  function mudar(k: keyof Valores, valor: string) {
    let x = valor;
    if (k === "renavam") x = soDigitos(valor).slice(0, 11);
    if (k === "ano_fabricacao" || k === "ano_modelo") x = soDigitos(valor).slice(0, 4);
    if (k === "chassi") x = valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
    const novo = { ...v, [k]: x };
    setV(novo);
    // Campo que já está com erro revalida a cada tecla (como o protótipo); o resto só ao sair.
    if (erros[k]) {
      definirErro(k, (COM_REGRA as readonly string[]).includes(k) ? regraCampo(k, x, { ...ctx(x), anoFabricacao: novo.ano_fabricacao }) : "");
    }
  }

  function definirErro(k: string, msg: string) {
    setErros((e) => (msg ? { ...e, [k]: msg } : Object.fromEntries(Object.entries(e).filter(([c]) => c !== k))));
  }

  function sair(k: keyof Valores) {
    if (!(COM_REGRA as readonly string[]).includes(k)) return;
    definirErro(k, regraCampo(k, v[k], ctx(v[k])));
    if (k === "renavam" && v.renavam.length === 11) {
      const alvo = v.renavam;
      consultarRenavam(alvo).then((r) => {
        if (!r.ok || !r.dados) return;
        setRenavamEmUso({ renavam: alvo, placa: r.dados });
        definirErro("renavam", `Renavam já cadastrado na placa ${r.dados}. Confira o documento.`);
      });
    }
  }

  const erroDe = (k: string) => erros[k] || undefined;

  /* ---------- o que falta para criar ---------- */
  function faltando(): string[] {
    if (!liberado) return ["uma placa nova e válida"];
    const valores: Record<string, string> = { ...v, proprietario_posse_id: posse?.id ?? "" };
    return OBRIGATORIOS.filter(([k]) => {
      const x = (valores[k] ?? "").trim();
      return !x || ((COM_REGRA as readonly string[]).includes(k) && regraCampo(k, x, ctx(x)) !== "");
    }).map(([, r]) => r);
  }
  const falta = faltando();

  const arrendado = !!posse && !!documento && posse.id !== documento.id;

  function escolherContrato(arquivo: File | null) {
    if (!arquivo) return;
    const erro = erroDoArquivo(arquivo);
    if (erro) {
      setContrato(null);
      setErroContrato(erro);
      return;
    }
    setErroContrato(null);
    setContrato(arquivo);
    toast("Contrato anexado ao cadastro");
  }

  /* ---------- criar ---------- */
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroGeral(null);
    const novos: Record<string, string> = {};
    for (const k of COM_REGRA) {
      const m = regraCampo(k, v[k], ctx(v[k]));
      if (m) novos[k] = m;
    }
    setErros(novos);
    if (faltando().length) {
      const primeiro = OBRIGATORIOS.find(([k]) => {
        const x = k === "proprietario_posse_id" ? (posse?.id ?? "") : v[k as keyof Valores].trim();
        return !x || novos[k];
      });
      if (primeiro) document.getElementById(primeiro[0])?.focus();
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("placa", p.placa);
    iniciar(async () => {
      const r = await criarVeiculo(fd);
      if (!r.ok) {
        setErroGeral(r.erro);
        if (r.campos) setErros(r.campos);
        return;
      }
      const { id, arrendado: nasceuArrendado } = r.dados;
      let envio = "";
      if (contrato && nasceuArrendado && tipoContratoId) {
        const prep = await prepararEnvio({
          veiculoId: id,
          tipoArquivoId: tipoContratoId,
          nome: contrato.name,
          mime: mimeDoArquivo(contrato.name, contrato.type) as "application/pdf",
          tamanho: contrato.size,
          validade: null,
          numero: null,
          restrito: admin,
        });
        let ok = prep.ok;
        if (prep.ok) {
          const up = await createBrowserClient()
            .storage.from("documentos")
            .upload(prep.dados.caminho, contrato, { upsert: false, contentType: mimeDoArquivo(contrato.name, contrato.type) });
          ok = !up.error;
        }
        if (!ok) envio = "&envio=falhou";
      }
      router.push(`/veiculos/${id}?criado=1${envio}`);
    });
  }

  const idPlaca = "placa";
  const corpoPlaca = p.completa ? null : (
    <b>
      {p.placa}
      {Array.from({ length: Math.max(0, 7 - p.placa.length) }, (_, i) => (
        <i className="vaga" key={i} />
      ))}
    </b>
  );
  const falta7 = 7 - p.placa.length;
  const tipoPrevia = p.placa.length < 5 ? "Placa" : p.mercosul ? "Placa Mercosul" : "Placa antiga (cinza)";

  return (
    <form id="form-novo" className="form-novo" noValidate onSubmit={aoEnviar}>
      <section className="secao" aria-labelledby="s-placa">
        <div className="secao-rotulo">
          <h2 id="s-placa">Placa</h2>
          <p>O NILT confere se a placa já está cadastrada antes de seguir. Placa antiga ou Mercosul, sem traço.</p>
        </div>
        <div className="campos">
          <div
            className="campo f4"
            id="campo-placa"
            data-invalido={p.invalida ? "" : undefined}
            data-valido={placaLivre ? "" : undefined}
          >
            <label htmlFor={idPlaca}>Placa</label>
            <input
              id={idPlaca}
              name="placa"
              className="entrada-placa"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
              placeholder="ABC1D23"
              aria-describedby="placa-msg"
              aria-invalid={p.invalida}
              value={placaBruta}
              onChange={(e) => aoDigitarPlaca(e.target.value)}
            />
            <span className={p.invalida ? "erro" : "ajuda"} id="placa-msg">
              {existente
                ? "Placa já cadastrada."
                : conferindo
                  ? "Conferindo se a placa já está cadastrada…"
                  : placaLivre
                    ? "Placa nova. Siga com o tipo e os dados do CRLV."
                    : p.mensagem}
            </span>
          </div>
          <div className="f8 previa-placa" id="previa" aria-hidden="true">
            {p.completa ? (
              <Placa placa={p.placa} grande />
            ) : (
              <span className={`placa grande${p.mercosul ? "" : " antiga"}`}>{corpoPlaca}</span>
            )}
            <span className="previa-txt">
              <b>{tipoPrevia}</b>
              <span>
                {falta7 > 0
                  ? `faltam ${falta7} ${falta7 === 1 ? "caractere" : "caracteres"}`
                  : placaLivre || existente
                    ? "formato válido"
                    : p.invalida
                      ? "confira a placa"
                      : "formato válido"}
              </span>
            </span>
          </div>
          {existente && (
            <div className="f12" id="existe">
              <div className="aviso aviso-info ja-existe">
                <Info size={18} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <b>{existente.placa} já está cadastrada.</b> {existente.tipo} {existente.marcaModelo}, de {existente.posse},
                  cadastro {existente.cadastro}. Não é preciso cadastrar de novo.
                </div>
                <Link className="btn" href={`/veiculos/${existente.id}`}>
                  Abrir a ficha
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <fieldset id="resto" className="resto" disabled={!liberado} aria-describedby="trava">
        <legend className="sr-only">Dados do veículo</legend>
        <p className="trava" id="trava">
          <Lock size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>Os campos abaixo abrem quando a placa estiver completa e ainda não cadastrada.</span>
        </p>

        <section className="secao" aria-labelledby="s-tipo">
          <div className="secao-rotulo">
            <h2 id="s-tipo">Tipo</h2>
            <p>
              O tipo define a categoria e os eixos. Cavalo puxa o conjunto e tem CMT; carreta e dolly engatam num cavalo; truck
              carrega sozinho.
            </p>
          </div>
          <div className="campos">
            <CampoNovo id="tipo_veiculo_id" classe="f6" rotulo="Tipo do veículo">
              <select
                id="tipo_veiculo_id"
                name="tipo_veiculo_id"
                required
                value={v.tipo_veiculo_id}
                onChange={(e) => mudar("tipo_veiculo_id", e.target.value)}
              >
                <option value="">Escolha o tipo</option>
                {(Object.keys(CATEGORIAS) as (keyof typeof CATEGORIAS)[]).map((cat) => (
                  <optgroup key={cat} label={CATEGORIAS[cat]}>
                    {tipos
                      .filter((t) => t.categoria === cat)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {nomeTipoLista(t.nome)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </CampoNovo>
            <div className="f6 tipo-resumo" id="tipo-resumo" aria-live="polite">
              {tipo ? (
                <dl className="kv">
                  <dt>Categoria</dt>
                  <dd>{CATEGORIAS[tipo.categoria]}</dd>
                  <dt>Eixos</dt>
                  <dd className="eixos-linha">
                    {tipo.eixos}
                    <span className="peca-eixos" aria-hidden="true">
                      {Array.from({ length: tipo.eixos }, (_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                  </dd>
                  {tipo.categoria === "cavalo" && (
                    <>
                      <dt>Configuração</dt>
                      <dd>{tipo.configuracao_cavalo === "trucado" ? "Trucado (tração com dois eixos atrás)" : "Toco (um eixo de tração)"}</dd>
                    </>
                  )}
                  <dt>Na ficha</dt>
                  <dd>
                    {tipo.categoria === "cavalo"
                      ? "informe o CMT para conferir o conjunto"
                      : tipo.categoria === "dolly"
                        ? "entra entre duas carretas; não leva carga"
                        : "PBT e tara dão a capacidade de carga"}
                  </dd>
                </dl>
              ) : (
                <p className="muted">Escolha o tipo para ver a categoria e os eixos.</p>
              )}
            </div>
          </div>
        </section>

        <section className="secao" aria-labelledby="s-crlv">
          <div className="secao-rotulo">
            <h2 id="s-crlv">Dados do CRLV</h2>
            <p>Copie do documento do veículo. Número de certificado, exercício e emissão ficam na ficha, aba CRLV.</p>
          </div>
          <div className="campos">
            <CampoNovo id="renavam" classe="f4" rotulo="Renavam" ajuda="11 dígitos." erro={erroDe("renavam")}>
              <input
                id="renavam"
                name="renavam"
                className="cod"
                inputMode="numeric"
                maxLength={11}
                autoComplete="off"
                required
                value={v.renavam}
                aria-invalid={!!erros.renavam}
                aria-describedby={erros.renavam ? "renavam-erro" : "renavam-ajuda"}
                onChange={(e) => mudar("renavam", e.target.value)}
                onBlur={() => sair("renavam")}
              />
            </CampoNovo>
            <CampoNovo id="chassi" classe="f5" rotulo="Chassi" ajuda="17 caracteres, sem I, O ou Q." erro={erroDe("chassi")}>
              <input
                id="chassi"
                name="chassi"
                className="cod"
                maxLength={17}
                autoComplete="off"
                spellCheck={false}
                required
                value={v.chassi}
                aria-invalid={!!erros.chassi}
                aria-describedby={erros.chassi ? "chassi-erro" : "chassi-ajuda"}
                onChange={(e) => mudar("chassi", e.target.value)}
                onBlur={() => sair("chassi")}
              />
            </CampoNovo>
            <CampoNovo id="cor" classe="f3" rotulo="Cor" opcional>
              <input id="cor" name="cor" autoComplete="off" value={v.cor} onChange={(e) => mudar("cor", e.target.value)} />
            </CampoNovo>
            <CampoNovo id="marca_id" classe="f4" rotulo="Marca">
              <select id="marca_id" name="marca_id" required value={v.marca_id} onChange={(e) => mudar("marca_id", e.target.value)}>
                <option value="">Escolha a marca</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </CampoNovo>
            <CampoNovo id="modelo" classe="f8" rotulo="Modelo">
              <input
                id="modelo"
                name="modelo"
                autoComplete="off"
                placeholder="Como está no CRLV, por exemplo R 450 A6x4"
                required
                value={v.modelo}
                onChange={(e) => mudar("modelo", e.target.value)}
              />
            </CampoNovo>
            <CampoNovo id="ano_fabricacao" classe="f3" rotulo="Ano de fabricação" erro={erroDe("ano_fabricacao")}>
              <input
                id="ano_fabricacao"
                name="ano_fabricacao"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                required
                value={v.ano_fabricacao}
                aria-invalid={!!erros.ano_fabricacao}
                aria-describedby={erros.ano_fabricacao ? "ano_fabricacao-erro" : undefined}
                onChange={(e) => mudar("ano_fabricacao", e.target.value)}
                onBlur={() => sair("ano_fabricacao")}
              />
            </CampoNovo>
            <CampoNovo id="ano_modelo" classe="f3" rotulo="Ano do modelo" erro={erroDe("ano_modelo")}>
              <input
                id="ano_modelo"
                name="ano_modelo"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                required
                value={v.ano_modelo}
                aria-invalid={!!erros.ano_modelo}
                aria-describedby={erros.ano_modelo ? "ano_modelo-erro" : undefined}
                onChange={(e) => mudar("ano_modelo", e.target.value)}
                onBlur={() => sair("ano_modelo")}
              />
            </CampoNovo>
            <CampoNovo id="uf_emplacamento" classe="f2" rotulo="UF">
              <select id="uf_emplacamento" name="uf_emplacamento" value={v.uf_emplacamento} onChange={(e) => mudar("uf_emplacamento", e.target.value)}>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </CampoNovo>
            <CampoNovo id="cidade_emplacamento" classe="f4" rotulo="Cidade de emplacamento" opcional>
              <input
                id="cidade_emplacamento"
                name="cidade_emplacamento"
                autoComplete="off"
                value={v.cidade_emplacamento}
                onChange={(e) => mudar("cidade_emplacamento", e.target.value)}
              />
            </CampoNovo>
          </div>
        </section>

        <section className="secao" aria-labelledby="s-prop">
          <div className="secao-rotulo">
            <h2 id="s-prop">Proprietários</h2>
            <p>
              Quem está no CRLV (posse) e quem está na ANTT (documento, sai impresso no CT-e). Quando são diferentes, o veículo é
              arrendado.
            </p>
            <p className="small">
              <Link href="/proprietarios/novo">Cadastrar proprietário novo</Link>
            </p>
          </div>
          <div className="campos">
            <div className="campo f6">
              <label htmlFor="proprietario_posse_id">Proprietário da posse (CRLV)</label>
              <SeletorPessoa
                id="proprietario_posse_id"
                nome="proprietario_posse_id"
                tipo="proprietario"
                valor={posse}
                aoMudar={setPosse}
                placeholder="Digite nome, CPF ou CNPJ de quem está no CRLV"
                descritoPor="ajuda-posse"
              />
              <span className="ajuda" id="ajuda-posse">
                {posse ? <InfoRntrc o={posse} antt={!documento || posse.id === documento.id} /> : "Nome que está no CRLV do veículo."}
              </span>
            </div>
            <div className="campo f6">
              <label htmlFor="proprietario_documento_id">Proprietário do documento (ANTT)</label>
              <SeletorPessoa
                id="proprietario_documento_id"
                nome="proprietario_documento_id"
                tipo="proprietario"
                valor={documento}
                aoMudar={setDocumento}
                placeholder="O mesmo da posse"
                limpavel
                descritoPor="ajuda-antt"
              />
              <span className="ajuda" id="ajuda-antt">
                {documento ? (
                  <InfoRntrc o={documento} antt />
                ) : posse ? (
                  `O mesmo da posse: ${posse.nome}.`
                ) : (
                  "Pessoa ou empresa que consta na ANTT."
                )}
              </span>
            </div>
            {arrendado && posse && documento && (
              <div className="f12" id="arrendado">
                <div className="arrendamento">
                  <div className="aviso aviso-info">
                    <Info size={18} strokeWidth={1.6} aria-hidden="true" />
                    <div>
                      <b>O veículo será marcado como arrendado.</b> A posse no CRLV é de {posse.nome} e a ANTT está em nome de{" "}
                      {documento.nome}. O NILT reconhece isso sozinho e exige o contrato de arrendamento anexado.
                    </div>
                  </div>
                  <div className={`upload${contrato ? " com-arquivo" : ""}`} id="upload">
                    {contrato ? (
                      <>
                        <FileCheck2 size={20} strokeWidth={1.6} aria-hidden="true" />
                        <span className="upload-txt">
                          <b>{contrato.name}</b>
                          <span>
                            {formato.kb(contrato.size)}
                            <Ponto />
                            CONTRATO
                            <Ponto />
                            {admin ? "restrito: só o administrador abre" : "enviado sem restrição (só o administrador restringe)"}
                          </span>
                        </span>
                        <button
                          className="btn btn-texto"
                          type="button"
                          id="tirar"
                          onClick={() => {
                            setContrato(null);
                            if (campoContrato.current) campoContrato.current.value = "";
                          }}
                        >
                          Tirar
                        </button>
                      </>
                    ) : (
                      <>
                        <FileUp size={20} strokeWidth={1.6} aria-hidden="true" />
                        <span className="upload-txt">
                          <b>Contrato de arrendamento</b>
                          <span>PDF, JPG, PNG ou HEIC até 20 MB.{admin ? " Fica restrito ao administrador." : ""}</span>
                        </span>
                        <button className="btn" type="button" id="escolher" onClick={() => campoContrato.current?.click()}>
                          <Paperclip size={16} strokeWidth={1.6} />
                          Escolher arquivo
                        </button>
                      </>
                    )}
                    <input
                      ref={campoContrato}
                      type="file"
                      id="arquivo-contrato"
                      accept={TIPOS_ACEITOS}
                      className="sr-only"
                      tabIndex={-1}
                      onChange={(e) => escolherContrato(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {erroContrato && (
                    <p className="small erro-texto" role="alert">
                      {erroContrato}
                    </p>
                  )}
                  {!contrato && (
                    <p className="small sem-contrato">
                      Sem o contrato, o veículo é criado mesmo assim e entra em Pendências como arrendado sem contrato.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </fieldset>

      {erroGeral && (
        <div className="aviso aviso-bloqueado" role="alert" style={{ marginTop: 16 }}>
          <Info size={18} strokeWidth={1.6} aria-hidden="true" />
          <div>{erroGeral}</div>
        </div>
      )}

      <div className="rodape-form">
        <p className="falta" id="falta" aria-live="polite">
          {falta.length
            ? `Para criar, falta: ${falta.join(", ")}.`
            : "Tudo certo para criar. O cadastro nasce pendente até a ficha ser conferida."}
        </p>
        <Link className="btn btn-texto" href="/veiculos">
          Cancelar
        </Link>
        <button className="btn btn-primario btn-grande" type="submit" id="criar" disabled={falta.length > 0 || gravando}>
          <Check size={16} strokeWidth={1.6} />
          {gravando ? "Criando…" : "Criar veículo"}
        </button>
      </div>
    </form>
  );
}
