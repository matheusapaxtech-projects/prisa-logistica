import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { resumoEvento } from "@/lib/auditoria";
import { hora } from "./dias";
import { obj, type Evento, type Resolucao } from "./consultas";

/* Linha da linha do tempo de /auditoria (`evento()` e `registro()` de prototipo/auditoria.html). */

const ACAO: Record<string, string> = { insert: "criou", update: "alterou", delete: "apagou", visualizacao: "visualizou documento" };

/** "a pessoa", "o veículo"… (o objeto do verbo). Vem do texto de `resumoEvento` para não repetir a tabela
   de `lib/auditoria.ts`: um delete de qualquer tabela que não seja arquivo diz "Apagou <objeto>". */
export function objetoDe(tabela: string): string {
  if (tabela === "arquivo") return "o arquivo";
  return resumoEvento({ tabela, acao: "delete", dados_antes: null, dados_depois: null }, { tipos: new Map() }).replace(/^Apagou /, "");
}

/** Tipos de arquivo vêm em caixa alta do banco; siglas ficam, palavras viram frase. */
export const tipoArquivo = (t: string): string => (/^[A-Z]{2,5}$/.test(t) ? t : t[0] + t.slice(1).toLowerCase());

const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Nome e link da ficha de uma pessoa (motorista ou proprietário), com `?aba=` opcional. */
function fichaPessoa(res: Resolucao, id: string, preferir: "motorista" | "proprietario" | null, aba?: string) {
  const nome = res.pessoas.get(id) ?? null;
  const rota =
    preferir === "motorista" || (preferir === null && res.motoristas.has(id))
      ? "motoristas"
      : preferir === "proprietario" || res.proprietarios.has(id)
        ? "proprietarios"
        : null;
  return { nome, href: rota ? `/${rota}/${id}${aba ? `?aba=${aba}` : ""}` : null };
}

function SemLink({ txt, por }: { txt: string; por?: string }) {
  return (
    <>
      <span className="nome apagado">{txt}</span>
      {por && <span className="de">{por}</span>}
    </>
  );
}

const ABA_DA_TABELA: Record<string, string> = {
  pessoa_conta_bancaria: "contas",
  pessoa_chave_pix: "contas",
  pessoa_endereco: "contatos",
  pessoa_telefone: "contatos",
  pessoa_email: "contatos",
  motorista_referencia: "referencias",
};

/** De quem é o arquivo (pessoa ou veículo) e para onde o link dele leva. */
export function donoDoArquivo(
  res: Resolucao,
  a: { pessoa_id: string | null; veiculo_id: string | null },
): { nome: string | null; href: string | null } | null {
  if (a.pessoa_id) return fichaPessoa(res, a.pessoa_id, null, "documentos");
  if (a.veiculo_id) {
    const placa = res.veiculos.get(a.veiculo_id) ?? null;
    return { nome: placa, href: placa ? `/veiculos/${a.veiculo_id}?aba=arquivos` : null };
  }
  return null;
}

/** O registro do evento, como link para a ficha (ou o motivo de não haver link). */
function Registro({ e, res }: { e: Evento; res: Resolucao }) {
  const id = e.registro_id;
  const dados = e.dados_depois ?? e.dados_antes;
  switch (e.tabela) {
    case "pessoa":
    case "motorista":
    case "proprietario":
    case "pessoa_conta_bancaria":
    case "pessoa_chave_pix":
    case "pessoa_endereco":
    case "pessoa_telefone":
    case "pessoa_email":
    case "motorista_referencia": {
      const proprio = ["pessoa", "motorista", "proprietario"].includes(e.tabela);
      const pid = proprio ? id : (texto(dados?.pessoa_id) ?? texto(dados?.motorista_id));
      const preferir =
        e.tabela === "motorista" || e.tabela === "motorista_referencia" ? "motorista" : e.tabela === "proprietario" ? "proprietario" : null;
      const f = pid ? fichaPessoa(res, pid, preferir, ABA_DA_TABELA[e.tabela]) : null;
      if (!f?.nome) return <SemLink txt={id} por="registro não encontrado" />;
      return f.href ? <Link href={f.href}>{f.nome}</Link> : <span className="nome">{f.nome}</span>;
    }
    case "veiculo": {
      const placa = res.veiculos.get(id);
      if (!placa) return <SemLink txt={id} por="registro não encontrado" />;
      return (
        <Link className="placa-link" href={`/veiculos/${id}`} aria-label={`Veículo ${placa}`}>
          <Placa placa={placa} />
        </Link>
      );
    }
    case "conjunto":
    case "conjunto_item": {
      const cid = e.tabela === "conjunto" ? id : texto(dados?.conjunto_id);
      const cavalo = cid ? res.conjuntos.get(cid) : undefined;
      const placa = cavalo ? res.veiculos.get(cavalo) : undefined;
      if (!cid || !placa) return <SemLink txt={cid ?? id} por="registro não encontrado" />;
      return <Link href={`/conjuntos/${cid}`}>Conjunto {placa}</Link>;
    }
    case "arquivo": {
      const a = res.arquivos.get(id);
      if (!a)
        return e.acao === "delete" ? (
          <SemLink txt="Arquivo apagado" por="não existe mais" />
        ) : (
          <SemLink txt={id} por="registro não encontrado" />
        );
      const dono = donoDoArquivo(res, a);
      return (
        <>
          {dono?.href ? <Link href={dono.href}>{a.nome ?? "Arquivo"}</Link> : <span className="nome">{a.nome ?? "Arquivo"}</span>}
          {dono?.nome && (
            <span className="de">
              de {dono.nome}
              {a.restrito && (
                <>
                  <Ponto />
                  restrito
                </>
              )}
            </span>
          )}
        </>
      );
    }
    case "perfil_usuario": {
      const u = res.usuarios.get(id);
      if (!u) return <SemLink txt={id} por="usuário removido" />;
      return <Link href={`/usuarios?editar=${id}`}>{u.nome}</Link>;
    }
    default:
      return <SemLink txt={id} />;
  }
}

export function EventoItem({ e, res }: { e: Evento; res: Resolucao }) {
  const u = e.usuario_id ? res.usuarios.get(e.usuario_id) : undefined;
  const nome = e.usuario_id ? (u?.nome ?? "Usuário removido") : "Sistema";
  const visto = e.acao === "visualizacao";
  const arquivo = e.tabela === "arquivo" ? res.arquivos.get(e.registro_id) : undefined;
  const nomeDosDados = texto(obj(e.dados_depois)?.nome_original) ?? texto(obj(e.dados_antes)?.nome_original);
  const resumo =
    resumoEvento(
      { tabela: e.tabela, acao: e.acao, dados_antes: e.dados_antes, dados_depois: e.dados_depois },
      { tipos: res.tipos, nomeArquivo: e.tabela === "arquivo" ? (arquivo?.nome ?? nomeDosDados) : null },
    ) + (visto && arquivo?.restrito ? " (restrito)" : "");
  return (
    <li className={`evento${visto ? " visto" : ""}`}>
      <time className="hora" dateTime={e.em}>
        {hora(e.em)}
      </time>
      <span className="no" aria-hidden="true" />
      <Avatar nome={nome} />
      <div className="txt">
        <p>
          <b>{nome}</b>
          {u && !u.ativo && (
            <>
              {" "}
              <span className="muted">(desativado)</span>
            </>
          )}{" "}
          {visto ? (
            <Sinal tipo="info" texto={ACAO[e.acao]} />
          ) : (
            <>
              {ACAO[e.acao] ?? e.acao} <span className="muted">{objetoDe(e.tabela)}</span>
            </>
          )}
        </p>
        <p className="resumo">{resumo}</p>
      </div>
      <div className="reg">
        <Registro e={e} res={res} />
      </div>
    </li>
  );
}
