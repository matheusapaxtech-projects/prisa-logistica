"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Pencil, Trash2 } from "lucide-react";
import { Campo } from "@/components/Campo";
import { Dialogo } from "@/components/Dialogo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { DialogoInclusao } from "../../_pessoa/dialogo-inclusao";
import { BotaoAdicionar, CabPainel, Dash, OpcoesUf } from "../../_pessoa/partes";
import { apagarLocal, salvarLocal } from "../actions";
import { enderecoDoLocal, type Local } from "../consultas";

type Props = {
  pessoaId: string;
  locais: Local[];
  /** Incluir e alterar (admin e operação). */
  podeEditar: boolean;
  /** Apagar (só administrador). */
  podeApagar: boolean;
};

/** O que o diálogo está fazendo: incluindo (`null` no local) ou alterando um local. */
type Edicao = { local: Local | null } | null;

/* Aba "Locais": onde o cliente carrega e descarrega (coleta e descarga), com a janela de atendimento
   e quem atende no local. Inclusão e alteração gravam na hora pelo diálogo. */
export function AbaLocais({ pessoaId, locais, podeEditar, podeApagar }: Props) {
  const router = useRouter();
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [apagando, setApagando] = useState<Local | null>(null);
  const [erroApagar, setErroApagar] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const l = edicao?.local ?? null;

  function confirmarApagar() {
    if (!apagando) return;
    const id = apagando.id;
    setErroApagar(null);
    iniciar(async () => {
      const r = await apagarLocal(id);
      if (!r.ok) {
        setErroApagar(r.erro);
        return;
      }
      setApagando(null);
      toast("Local apagado.", "trash-2");
      router.refresh();
    });
  }

  return (
    <>
      <div className="subsecao">
        <CabPainel titulo="Locais de coleta e descarga">
          {podeEditar && <BotaoAdicionar onClick={() => setEdicao({ local: null })}>Adicionar local</BotaoAdicionar>}
        </CabPainel>
        {locais.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">Local</th>
                  <th scope="col">Janela de atendimento</th>
                  <th scope="col">Contato no local</th>
                  {(podeEditar || podeApagar) && (
                    <th scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {locais.map((x) => (
                  <tr key={x.id}>
                    <td className="cel-1">
                      <span className="id">
                        {x.cidade}/{x.uf}
                      </span>
                      <span className="linha2">
                        {enderecoDoLocal(x) || "endereço não informado"}
                        {x.cep && (
                          <>
                            <Ponto />
                            <span className="cod">{formato.cep(x.cep)}</span>
                          </>
                        )}
                        {x.ponto_referencia && (
                          <>
                            <Ponto />
                            {x.ponto_referencia}
                          </>
                        )}
                      </span>
                    </td>
                    <td>{x.janela_atendimento || <Dash />}</td>
                    <td>{x.contato_local || <Dash />}</td>
                    {(podeEditar || podeApagar) && (
                      <td className="acoes-linha">
                        {podeEditar && (
                          <button className="btn btn-texto" type="button" onClick={() => setEdicao({ local: x })} aria-label={`Alterar o local de ${x.cidade}/${x.uf}`}>
                            <Pencil size={16} strokeWidth={1.6} aria-hidden="true" />
                            Alterar
                          </button>
                        )}
                        {podeApagar && (
                          <button
                            className="btn btn-texto btn-perigo"
                            type="button"
                            onClick={() => {
                              setErroApagar(null);
                              setApagando(x);
                            }}
                            aria-label={`Apagar o local de ${x.cidade}/${x.uf}`}
                          >
                            <Trash2 size={16} strokeWidth={1.6} aria-hidden="true" />
                            Apagar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>
            Nenhum local cadastrado. O pedido deste cliente precisa de pelo menos um local de coleta ou de descarga
            {podeEditar ? ": use “Adicionar local”." : "."}
          </EstadoVazio>
        )}
      </div>

      {podeEditar && (
        <DialogoInclusao
          aberto={edicao !== null}
          aoFechar={() => setEdicao(null)}
          titulo={l ? "Alterar local" : "Adicionar local"}
          botao={l ? "Salvar local" : "Adicionar local"}
          sucesso={l ? "Local alterado." : "Local adicionado."}
          acao={(f) => salvarLocal(null, f)}
        >
          {(c) => (
            <>
              <input type="hidden" name="pessoa_id" value={pessoaId} />
              <input type="hidden" name="id" value={l?.id ?? ""} />
              <Campo classe="f4" id="local-cep" name="cep" label="CEP" opcional mascara="cep" placeholder="00000-000" autoComplete="off" defaultValue={l?.cep ?? ""} erro={c.cep} />
              <Campo classe="f8" id="local-logradouro" name="logradouro" label="Rua, rodovia ou estrada" opcional autoComplete="off" defaultValue={l?.logradouro ?? ""} erro={c.logradouro} />
              <Campo classe="f3" id="local-numero" name="numero" label="Número" placeholder="s/n" autoComplete="off" defaultValue={l?.numero ?? ""} erro={c.numero} />
              <Campo classe="f4" id="local-complemento" name="complemento" label="Complemento" opcional autoComplete="off" defaultValue={l?.complemento ?? ""} />
              <Campo classe="f5" id="local-bairro" name="bairro" label="Bairro" opcional autoComplete="off" defaultValue={l?.bairro ?? ""} />
              <Campo classe="f9" id="local-cidade" name="cidade" label="Cidade" autoComplete="off" defaultValue={l?.cidade ?? ""} erro={c.cidade} />
              <Campo
                classe="f3"
                id="local-uf"
                label="UF"
                erro={c.uf}
                controle={
                  <select id="local-uf" name="uf" defaultValue={l?.uf ?? ""}>
                    <OpcoesUf />
                  </select>
                }
              />
              <Campo
                classe="f12"
                id="local-ponto"
                name="ponto_referencia"
                label="Nome ou ponto de referência"
                opcional
                placeholder="Ex.: Armazém 2, entrada pela portaria norte"
                autoComplete="off"
                defaultValue={l?.ponto_referencia ?? ""}
              />
              <Campo
                classe="f6"
                id="local-janela"
                name="janela_atendimento"
                label="Janela de atendimento"
                opcional
                placeholder="Ex.: seg a sex, 7h às 17h"
                autoComplete="off"
                defaultValue={l?.janela_atendimento ?? ""}
                erro={c.janela_atendimento}
              />
              <Campo
                classe="f6"
                id="local-contato"
                name="contato_local"
                label="Contato no local"
                opcional
                placeholder="Nome e telefone de quem atende"
                autoComplete="off"
                defaultValue={l?.contato_local ?? ""}
                erro={c.contato_local}
              />
            </>
          )}
        </DialogoInclusao>
      )}

      {podeApagar && (
        <Dialogo
          aberto={apagando !== null}
          aoFechar={() => setApagando(null)}
          titulo="Apagar local"
          onSubmit={(e) => {
            e.preventDefault();
            confirmarApagar();
          }}
          pe={
            <>
              <button className="btn" type="button" data-fechar disabled={gravando}>
                Cancelar
              </button>
              <button className="btn btn-perigo" type="submit" disabled={gravando}>
                {gravando ? "Apagando…" : "Apagar local"}
              </button>
            </>
          }
        >
          {erroApagar && (
            <div className="aviso aviso-bloqueado" role="alert">
              <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>{erroApagar}</span>
            </div>
          )}
          <p>
            Apagar o local de{" "}
            <b>
              {apagando?.cidade}/{apagando?.uf}
            </b>
            {apagando && enderecoDoLocal(apagando) ? ` (${enderecoDoLocal(apagando)})` : ""}? Local que já está em pedido não pode ser apagado.
          </p>
        </Dialogo>
      )}
    </>
  );
}
