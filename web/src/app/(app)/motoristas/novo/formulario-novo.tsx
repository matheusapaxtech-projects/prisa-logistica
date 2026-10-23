"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, CircleCheck, Info } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Campo } from "@/components/Campo";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { prepararEnvio } from "@/components/documentos-acoes";
import { erroDoArquivo, mimeDoArquivo, TIPOS_ACEITOS } from "@/lib/arquivos";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { createBrowserClient } from "@/lib/supabase/client";
import { ConsultaDocumento, type Consulta, type ConsultaDocumentoRef } from "../../_pessoa/consulta-documento";
import { MSG_FALTAM_DADOS } from "../../_pessoa/formulario";
import { Opcoes } from "../../_pessoa/partes";
import { ROT } from "../../_pessoa/rotulos";
import { criarMotorista, ligarMotorista } from "../actions";

type Props = {
  /** `?cpf=` vindo da ficha de quem ainda não é motorista. */
  cpfInicial: string;
  /** Id do tipo de arquivo "CNH" (envio opcional da CNH digital). */
  tipoCnhId: number | null;
};

type Modo = "novo" | "ligar" | "existe" | null;

function modoDe(c: Consulta): Modo {
  if (c.estado !== "achado") return null;
  if (!c.pessoa) return "novo";
  return c.pessoa.motorista ? "existe" : "ligar";
}

/** Envia a CNH digital escolhida (linha em `arquivo` primeiro, depois o objeto). Devolve o aviso, se falhou. */
async function enviarCnh(pessoaId: string, tipoCnhId: number, arquivo: File, validade: string): Promise<string | null> {
  const r = await prepararEnvio({
    pessoaId,
    tipoArquivoId: tipoCnhId,
    nome: arquivo.name,
    mime: mimeDoArquivo(arquivo.name, arquivo.type) as "application/pdf",
    tamanho: arquivo.size,
    validade: validade || null,
    numero: null,
    restrito: false,
  });
  if (!r.ok) return `A CNH digital não foi anexada: ${r.erro} Anexe na aba Documentos.`;
  const { error } = await createBrowserClient()
    .storage.from("documentos")
    .upload(r.dados.caminho, arquivo, { upsert: false, contentType: mimeDoArquivo(arquivo.name, arquivo.type) });
  return error ? "A CNH digital não chegou ao armazenamento: use “Enviar de novo” na aba Documentos." : null;
}

/* Novo motorista (motorista-novo.html): CPF primeiro; a pessoa já cadastrada abre a ficha ou ganha
   o papel de motorista; a nova recebe os dados mínimos e a CNH. */
export function FormularioNovo({ cpfInicial, tipoCnhId }: Props) {
  const router = useRouter();
  const consultaRef = useRef<ConsultaDocumentoRef>(null);
  const [consulta, setConsulta] = useState<Consulta>({ estado: "nada" });
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [avisoValidade, setAvisoValidade] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const [criado, setCriado] = useState(false);

  const modo = modoDe(consulta);
  const pessoa = consulta.estado === "achado" ? consulta.pessoa : null;
  const travar = modo === null || modo === "existe";

  function mudarConsulta(c: Consulta) {
    setConsulta(c);
    // Só um CPF novo apaga o aviso; a reconsulta depois de uma falha parcial mantém a explicação.
    if (c.estado === "nada") setErro(null);
  }

  function aoMudarValidade(e: ChangeEvent<HTMLInputElement>) {
    const v = e.currentTarget.value;
    const d = v ? diasAte(v) : 0;
    setAvisoValidade(v && d < 0 ? `CNH vencida (${formato.dias(d)}). O cadastro fica pendente até a renovação.` : null);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (modo !== "novo" && modo !== "ligar") {
      consultaRef.current?.verificar();
      consultaRef.current?.focar();
      return;
    }
    const form = e.currentTarget;
    const dados = new FormData(form);
    const arquivo = dados.get("cnh_arquivo");
    dados.delete("cnh_arquivo");
    const cnh = arquivo instanceof File && arquivo.size ? arquivo : null;
    const problemaArquivo = cnh ? erroDoArquivo(cnh) : null;
    if (modo === "ligar" && pessoa) dados.set("pessoa_id", pessoa.id);
    setCampos({});
    setErro(null);
    setErroArquivo(problemaArquivo);
    if (problemaArquivo) {
      form.querySelector<HTMLElement>("#cnh_arquivo")?.focus();
      toast(MSG_FALTAM_DADOS, "alert-circle");
      return;
    }
    iniciar(async () => {
      const r = modo === "ligar" ? await ligarMotorista(dados) : await criarMotorista(dados);
      if (!r.ok) {
        if ("campos" in r) {
          setCampos(r.campos);
          form.querySelector<HTMLElement>(`[name="${Object.keys(r.campos)[0]}"]`)?.focus();
          toast(MSG_FALTAM_DADOS, "alert-circle");
        } else {
          setErro(r.erro);
          // A pessoa pode ter sido criada sem o papel de motorista: conferir o CPF de novo leva ao
          // modo "ligar" (a CNH digitada continua nos campos).
          if (modo === "novo") consultaRef.current?.verificar();
        }
        return;
      }
      setCriado(true);
      const avisos = [...r.dados.avisos];
      if (cnh && tipoCnhId) {
        const aviso = await enviarCnh(r.dados.id, tipoCnhId, cnh, String(dados.get("cnh_validade") ?? ""));
        if (aviso) avisos.push(aviso);
      }
      toast(modo === "ligar" ? `${pessoa?.nome} agora também é motorista. Abrindo a ficha…` : "Motorista criado como pendente. Abrindo a ficha…");
      for (const a of avisos) toast(a, "alert-circle");
      router.push(`/motoristas/${r.dados.id}`);
    });
  }

  return (
    <form id="form-novo" noValidate onSubmit={enviar}>
      <section className="secao" aria-labelledby="h-cpf">
        <div className="secao-rotulo">
          <h2 id="h-cpf">CPF do motorista</h2>
          <p>A mesma pessoa pode ser motorista e proprietária. Se o CPF já existir, você abre a ficha ou liga o papel de motorista à pessoa.</p>
        </div>
        <div className="campos">
          <ConsultaDocumento
            ref={consultaRef}
            tipo="cpf"
            id="cpf"
            name="cpf"
            label="CPF"
            classe="f5"
            inicial={cpfInicial}
            ajuda="A conferência acontece sozinha ao completar os 11 dígitos."
            aoMudar={mudarConsulta}
          />
          <div className="f12 resultado" aria-live="polite">
            <Resultado consulta={consulta} />
          </div>
        </div>
      </section>

      <section className="secao" aria-labelledby="h-pessoa" hidden={modo === "existe" || modo === "ligar"}>
        <div className="secao-rotulo">
          <h2 id="h-pessoa">Dados mínimos da pessoa</h2>
          <p>O suficiente para criar o cadastro. RG, filiação, endereço e contas você completa depois, na ficha.</p>
        </div>
        <div className="campos">
          <Campo classe="f8" id="nome" name="nome" label="Nome completo" maxLength={110} autoComplete="off" disabled={travar} erro={campos.nome} />
          <Campo classe="f4" id="nascimento" name="nascimento" type="date" label="Nascimento" disabled={travar} erro={campos.nascimento} />
          <Campo
            classe="f4"
            id="telefone"
            name="telefone"
            label="Telefone celular"
            mascara="telefone"
            placeholder="(00) 00000-0000"
            autoComplete="off"
            disabled={travar}
            erro={campos.telefone}
          />
          <div className="campo f4">
            <span className="rotulo" aria-hidden="true">
              &nbsp;
            </span>
            <label className="marcar" htmlFor="whatsapp">
              <input type="checkbox" id="whatsapp" name="whatsapp" defaultChecked disabled={travar} />
              Este número tem WhatsApp
            </label>
          </div>
        </div>
      </section>

      <section className="secao" aria-labelledby="h-cnh" hidden={modo === "existe"}>
        <div className="secao-rotulo">
          <h2 id="h-cnh">CNH</h2>
          <p>Número de registro, categoria e validade, como estão na carteira. Pode anexar a CNH digital já aqui.</p>
        </div>
        <div className="campos">
          <Campo
            classe="f4"
            id="cnh_registro"
            name="cnh_registro"
            label="Número de registro"
            className="cod"
            mascara="digitos"
            maxLength={11}
            placeholder="11 dígitos"
            autoComplete="off"
            disabled={travar}
            erro={campos.cnh_registro}
          />
          <Campo
            classe="f4"
            id="cnh_categoria"
            label="Categoria"
            erro={campos.cnh_categoria}
            controle={
              <select id="cnh_categoria" name="cnh_categoria" defaultValue="e" disabled={travar}>
                <Opcoes mapa={ROT.cnh_categoria} />
              </select>
            }
          />
          <Campo
            classe="f4"
            id="cnh_validade"
            name="cnh_validade"
            type="date"
            label="Validade"
            disabled={travar}
            erro={campos.cnh_validade}
            ajuda={avisoValidade ?? undefined}
            onChange={aoMudarValidade}
          />
          <Campo
            classe="f8"
            id="cnh_arquivo"
            label={<>CNH digital</>}
            opcional
            erro={erroArquivo}
            ajuda={<span id="arq-ajuda">PDF ou foto, até 20 MB. O motorista baixa o PDF no app Carteira Digital de Trânsito.</span>}
            controle={
              <input
                id="cnh_arquivo"
                name="cnh_arquivo"
                type="file"
                accept={TIPOS_ACEITOS}
                aria-describedby="arq-ajuda"
                disabled={travar}
                onChange={() => setErroArquivo(null)}
              />
            }
          />
        </div>
      </section>

      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      <div className="acoes-fim" hidden={modo === "existe"}>
        {travar && <span className="muted acoes-nota">Confira o CPF para liberar os campos.</span>}
        <Link className="btn" href="/motoristas">
          Cancelar
        </Link>
        <button className="btn btn-primario" type="submit" disabled={modo === null || gravando || criado}>
          <Check size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{gravando ? "Gravando…" : modo === "ligar" ? "Cadastrar também como motorista" : "Criar motorista"}</span>
        </button>
      </div>
    </form>
  );
}

function Resultado({ consulta }: { consulta: Consulta }) {
  if (consulta.estado === "buscando") return <p className="muted">Procurando o CPF no NILT…</p>;
  if (consulta.estado === "erro")
    return (
      <div className="aviso aviso-bloqueado" role="alert">
        <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
        <span>{consulta.erro}</span>
      </div>
    );
  if (consulta.estado !== "achado") return null;
  const p = consulta.pessoa;
  if (!p)
    return (
      <div className="aviso aviso-normal">
        <CircleCheck size={16} strokeWidth={1.6} aria-hidden="true" />
        <span>
          <b>CPF válido e ainda não cadastrado.</b> Preencha os dados mínimos abaixo; o resto você completa na ficha.
        </span>
      </div>
    );
  if (p.motorista)
    return (
      <div className="bloco achado-pessoa">
        <Avatar nome={p.nome} />
        <div>
          <b>{p.nome}</b>
          <span className="sub">
            Já é motorista
            <Ponto />
            CPF <span className="cod">{formato.cpf(p.documento)}</span>
            {p.telefone && (
              <>
                <Ponto />
                {formato.telefone(p.telefone)}
              </>
            )}
            {p.proprietario && (
              <>
                <Ponto />
                também é proprietário
              </>
            )}
          </span>
        </div>
        <div className="acoes-achado">
          <Sinal situacao={p.motorista.situacao_cadastro} />
          <Link className="btn btn-primario" href={`/motoristas/${p.id}`}>
            <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
            Abrir ficha do motorista
          </Link>
        </div>
      </div>
    );
  const prop = p.proprietario;
  return (
    <>
      <div className="bloco achado-pessoa">
        <Avatar nome={p.nome} />
        <div>
          <b>{p.nome}</b>
          <span className="sub">
            {prop ? (
              <>
                Cadastrado como proprietário{prop.enquadramento_antt ? ` (${prop.enquadramento_antt.toUpperCase()})` : ""}
                {prop.rntrc && (
                  <>
                    <Ponto />
                    RNTRC <span className="cod">{prop.rntrc}</span>
                  </>
                )}
              </>
            ) : (
              "Cadastro de pessoa incompleto"
            )}
            <Ponto />
            ainda não é motorista
          </span>
        </div>
        {prop && (
          <Link className="btn" href={`/proprietarios/${p.id}`}>
            Ver proprietário
          </Link>
        )}
      </div>
      <div className="aviso aviso-info aviso-ligar">
        <Info size={16} strokeWidth={1.6} aria-hidden="true" />
        <span>É a mesma pessoa: nome, documentos, contatos e contas continuam os mesmos. Para ligar o papel de motorista, falta só a CNH.</span>
      </div>
    </>
  );
}
