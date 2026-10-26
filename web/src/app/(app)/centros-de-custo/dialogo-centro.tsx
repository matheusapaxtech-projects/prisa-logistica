"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { CampoDialogo } from "../financeiro/contas-comum/campo-dialogo";
import { criarCentro, definirAtivo, renomearCentro } from "./actions";
import { lerCentroNovo, lerNome, MAX_NOME, type CampoCentro, type CentroLinha } from "./regras";

/* Botão do alto da tela (o único primário) e o diálogo "Novo centro de custo". */
export function BotaoNovoCentro({ codigos }: { codigos: string[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="btn btn-primario" type="button" onClick={() => setAberto(true)}>
        <Plus size={16} strokeWidth={1.7} aria-hidden="true" />
        Novo centro de custo
      </button>
      {aberto && <DialogoNovo codigos={codigos} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function DialogoNovo({ codigos, aoFechar }: { codigos: string[]; aoFechar: () => void }) {
  const id = useId();
  const [erros, setErros] = useState<Partial<Record<CampoCentro, string>>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const campo = (c: CampoCentro) => `${id}-${c}`;

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setErroAcao(null);
    const lido = lerCentroNovo(dados, codigos);
    if (!lido.ok) {
      setErros(lido.erros);
      form.querySelector<HTMLElement>(`[name="${Object.keys(lido.erros)[0]}"]`)?.focus();
      return;
    }
    setErros({});
    iniciar(async () => {
      const r = await criarCentro(dados);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast("Centro de custo criado.");
      aoFechar();
    });
  }

  function limpar(e: FormEvent<HTMLDivElement>) {
    const nome = (e.target as HTMLElement).getAttribute("name") as CampoCentro | null;
    if (nome && erros[nome]) setErros((antes) => ({ ...antes, [nome]: undefined }));
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Novo centro de custo"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
            Criar centro de custo
          </button>
        </>
      }
    >
      <div className="campos" onInput={limpar}>
        <CampoDialogo
          classe="f4"
          id={campo("codigo")}
          rotulo="Código"
          erro={erros.codigo}
          ajuda="Para um subdepartamento (00.00), o departamento (00) precisa existir."
        >
          <input
            id={campo("codigo")}
            name="codigo"
            className="mono"
            inputMode="decimal"
            autoComplete="off"
            maxLength={5}
            placeholder="00 ou 00.00"
            aria-invalid={!!erros.codigo || undefined}
            aria-describedby={[`${campo("codigo")}-ajuda`, erros.codigo ? `${campo("codigo")}-erro` : null].filter(Boolean).join(" ")}
          />
        </CampoDialogo>
        <CampoDialogo classe="f8" id={campo("nome")} rotulo="Nome" erro={erros.nome}>
          <input
            id={campo("nome")}
            name="nome"
            autoComplete="off"
            maxLength={MAX_NOME}
            aria-invalid={!!erros.nome || undefined}
            aria-describedby={erros.nome ? `${campo("nome")}-erro` : undefined}
          />
        </CampoDialogo>
      </div>
      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}

/* Diálogo "Renomear": só o nome; o código aparece, sem poder mudar. Monte só quando for abrir. */
export function DialogoRenomear({ centro, aoFechar }: { centro: CentroLinha; aoFechar: () => void }) {
  const id = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroAcao(null);
    const lido = lerNome(new FormData(e.currentTarget).get("nome"));
    if (!lido.ok) {
      setErro(lido.erro);
      e.currentTarget.querySelector<HTMLElement>('[name="nome"]')?.focus();
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await renomearCentro(centro.id, lido.nome);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast("Nome atualizado.");
      aoFechar();
    });
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Renomear centro de custo"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
            Salvar o nome
          </button>
        </>
      }
    >
      <p className="nota">
        Código <span className="cod">{centro.codigo}</span> (não muda).
      </p>
      <div className="campos" onInput={() => erro && setErro(null)}>
        <CampoDialogo classe="f12" id={`${id}-nome`} rotulo="Nome" erro={erro ?? undefined}>
          <input
            id={`${id}-nome`}
            name="nome"
            autoComplete="off"
            maxLength={MAX_NOME}
            defaultValue={centro.nome}
            aria-invalid={!!erro || undefined}
            aria-describedby={erro ? `${id}-nome-erro` : undefined}
          />
        </CampoDialogo>
      </div>
      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}

/* Confirmação de "Desativar" (a ação é de um clique, mas explica o efeito). Reativar não pede confirmação. */
export function DialogoDesativar({ centro, aoFechar }: { centro: CentroLinha; aoFechar: () => void }) {
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroAcao(null);
    iniciar(async () => {
      const r = await definirAtivo(centro.id, false);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast("Centro de custo desativado.");
      aoFechar();
    });
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Desativar centro de custo"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Voltar
          </button>
          <button className="btn btn-perigo" type="submit" disabled={gravando} aria-busy={gravando}>
            Desativar
          </button>
        </>
      }
    >
      <p>
        <span className="cod">{centro.codigo}</span> · <b>{centro.nome}</b>
      </p>
      <p className="nota">Contas já lançadas continuam com este centro; ele só some das opções novas.</p>
      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}
