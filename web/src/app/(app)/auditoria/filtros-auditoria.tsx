"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ACOES, TIPOS, montarBusca, type Filtros } from "./filtros";

type Props = {
  /** Filtros que valem agora (vêm da URL, lidos no servidor). */
  valores: Filtros;
  usuarios: { id: string; nome: string }[];
  /** Nome do registro de `?registro=` (se não achou, o próprio id). */
  registroNome: string | null;
  /** "12 eventos de 80 · 2 visualizações" (o ponto do meio é `<Ponto />`). */
  total: ReactNode;
};

/* Barra de filtros de /auditoria. Os três selects trocam a URL (`?usuario=&tipo=&acao=`); quem lê é o
   servidor, então o filtro sobrevive ao recarregar e o link pode ser compartilhado. */
export function FiltrosAuditoria(props: Props) {
  // Quando a URL muda, o servidor manda `valores` novos e a barra recomeça deles (os selects não ficam velhos).
  return <Barra key={JSON.stringify(props.valores)} {...props} />;
}

function Barra({ valores, usuarios, registroNome, total }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const [pendente, startTransition] = useTransition();
  const [f, setF] = useState(valores);
  const algum = Boolean(valores.usuario || valores.tipo || valores.acao || valores.registro);

  function trocar(campo: "usuario" | "tipo" | "acao", valor: string) {
    const novo = { ...f, [campo]: valor };
    setF(novo);
    // Mudar o filtro volta ao começo da lista (sem `limite`).
    startTransition(() => router.replace(`${caminho}${montarBusca({ ...novo, limite: undefined })}`, { scroll: false }));
  }

  return (
    <div className="ferramentas" role="search" aria-label="Filtrar eventos" aria-busy={pendente}>
      <label className="filtro">
        <span className="sr-only">Usuário</span>
        <select id="f-usuario" aria-label="Usuário" value={f.usuario} onChange={(e) => trocar("usuario", e.target.value)}>
          <option value="">Todos os usuários</option>
          <option value="sistema">Sistema</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="filtro">
        <span className="sr-only">Tipo de registro</span>
        <select id="f-tabela" aria-label="Tipo de registro" value={f.tipo} onChange={(e) => trocar("tipo", e.target.value)}>
          <option value="">Todos os registros</option>
          {TIPOS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.rot}
            </option>
          ))}
        </select>
      </label>
      <label className="filtro">
        <span className="sr-only">Ação</span>
        <select id="f-acao" aria-label="Ação" value={f.acao} onChange={(e) => trocar("acao", e.target.value)}>
          <option value="">Todas as ações</option>
          {ACOES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.rot}
            </option>
          ))}
        </select>
      </label>
      <span id="f-registro">
        {valores.registro && (
          <span className="filtro-registro">
            Só {registroNome ?? valores.registro}
            <Link
              className="btn btn-texto btn-icone"
              id="f-sem-registro"
              aria-label="Mostrar todos os registros"
              href={`${caminho}${montarBusca({ ...valores, registro: "", limite: undefined })}`}
              replace
              scroll={false}
            >
              <X size={16} strokeWidth={1.6} aria-hidden="true" />
            </Link>
          </span>
        )}
      </span>
      {algum && (
        <Link className="btn btn-texto" id="f-limpar" href={caminho} replace scroll={false}>
          Limpar filtros
        </Link>
      )}
      <span className="total" id="total" aria-live="polite">
        {total}
      </span>
    </div>
  );
}
