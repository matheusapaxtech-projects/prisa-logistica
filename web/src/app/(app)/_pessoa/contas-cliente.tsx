"use client";

import { useState, type ChangeEvent } from "react";
import { TriangleAlert } from "lucide-react";
import { Campo } from "@/components/Campo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { formato } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import { adicionarConta, adicionarPix } from "./actions";
import type { BancoLinha, ChavePix, Conta } from "./consultas";
import { DialogoInclusao } from "./dialogo-inclusao";
import { BotaoAdicionar, CabPainel, Dash, Marca, Marcar, Opcoes } from "./partes";
import { ROT, rotulo } from "./rotulos";

export type TextosContas = { contas: string; pix: string };

/** Ex.: { o: "o motorista", do: "do motorista", proprio: "o próprio motorista" }. */
export type Quem = { o: string; do: string; proprio: string };

type Props = {
  pessoaId: string;
  /** Nome e documento (CPF ou CNPJ, só dígitos) da pessoa: sugestão de favorecido e de chave Pix. */
  nome: string;
  documento: string;
  /** Quem é a pessoa nesta ficha, nas três formas que os textos usam. */
  quem: Quem;
  contas: Conta[];
  pix: ChavePix[];
  bancos: BancoLinha[];
  /** Pode incluir conta e Pix (admin, operação e financeiro). */
  podeEditar: boolean;
  revalidar: string[];
  textos: TextosContas;
};

const doc = (d: string | null) => (d && d.length === 14 ? formato.cnpj(d) : formato.cpf(d));
const comDigito = (n: string | null, dig: string | null) => `${n ?? ""}${dig ? `-${dig}` : ""}`;

/* Aba Contas e Pix (renderContas + diálogos conta/Pix de prototipo/motorista.html). */
export function ContasPainel({ pessoaId, nome, documento, quem, contas, pix, bancos, podeEditar, revalidar, textos }: Props) {
  const [aberto, setAberto] = useState<"conta" | "pix" | null>(null);
  const fechar = () => setAberto(null);
  const nomeBanco = new Map(bancos.map((b) => [b.codigo, b.nome]));
  const contaTxt = (c: Conta) =>
    `${c.banco_codigo ?? ""} ${nomeBanco.get(c.banco_codigo ?? "") ?? ""} · ag. ${comDigito(c.agencia, c.agencia_digito)} · conta ${comDigito(c.conta, c.conta_digito)}`;
  const difere = contas.filter((c) => !c.titular_confere);
  const pj = documento.length === 14;

  return (
    <>
      <div className="subsecao">
        <CabPainel titulo="Contas bancárias">
          {podeEditar && <BotaoAdicionar onClick={() => setAberto("conta")}>Adicionar conta</BotaoAdicionar>}
        </CabPainel>
        {difere.length > 0 && (
          <div className="pendencias-ficha">
            {difere.map((c) => (
              <div className="aviso aviso-pendente" key={c.id}>
                <TriangleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
                <span>
                  <b>Titular não confere.</b> A conta {nomeBanco.get(c.banco_codigo ?? "") ?? c.banco_codigo} ag. {c.agencia} está em
                  nome de {c.favorecido_nome} (<span className="cod">{doc(c.favorecido_documento)}</span>), não {quem.do}. Confirme a autorização por escrito antes de pagar frete nela.
                </span>
              </div>
            ))}
          </div>
        )}
        {contas.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">Banco</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="num">
                    Agência
                  </th>
                  <th scope="col" className="num">
                    Conta
                  </th>
                  <th scope="col">Favorecido</th>
                  <th scope="col">
                    <span className="sr-only">Marcas</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id}>
                    <td className="cel-1">
                      <span className="id">{nomeBanco.get(c.banco_codigo ?? "") ?? "Banco"}</span>
                      <span className="linha2">
                        <span className="cod">{c.banco_codigo}</span>
                      </span>
                    </td>
                    <td>{rotulo(ROT.tipo_conta, c.tipo) ?? <Dash />}</td>
                    <td className="num">
                      <span className="cod">{comDigito(c.agencia, c.agencia_digito)}</span>
                    </td>
                    <td className="num">
                      <span className="cod">{comDigito(c.conta, c.conta_digito)}</span>
                    </td>
                    <td>
                      {c.favorecido_nome || nome}
                      <span className="linha2">
                        {c.titular_confere ? quem.proprio : <span className="val val-pendente">titular diferente</span>}
                      </span>
                    </td>
                    <td className="acoes-linha">{c.principal && <Marca icone="star">Principal</Marca>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>{textos.contas}</EstadoVazio>
        )}
      </div>

      <div className="subsecao">
        <CabPainel titulo="Chaves Pix">
          {podeEditar && <BotaoAdicionar onClick={() => setAberto("pix")}>Adicionar chave Pix</BotaoAdicionar>}
        </CabPainel>
        {pix.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">Chave</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Conta ligada</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">
                    <span className="sr-only">Marcas</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pix.map((x) => {
                  const c = contas.find((k) => k.id === x.conta_id);
                  const chave =
                    x.tipo === "cpf" ? formato.cpf(x.chave) : x.tipo === "cnpj" ? formato.cnpj(x.chave) : x.tipo === "celular" ? formato.telefone(x.chave) : x.chave;
                  return (
                    <tr key={x.id}>
                      <td className="cel-1">
                        <span className="id cod">{chave}</span>
                      </td>
                      <td>{rotulo(ROT.tipo_chave_pix, x.tipo)}</td>
                      <td>
                        {c ? (
                          <>
                            {nomeBanco.get(c.banco_codigo ?? "") ?? c.banco_codigo}{" "}
                            <span className="muted">
                              <Ponto />
                              ag. {c.agencia}
                              <Ponto />
                              {comDigito(c.conta, c.conta_digito)}
                            </span>
                          </>
                        ) : (
                          <Dash>sem conta ligada</Dash>
                        )}
                      </td>
                      <td>{x.descricao || <Dash />}</td>
                      <td className="acoes-linha">{x.principal && <Marca icone="star">Principal</Marca>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>{textos.pix}</EstadoVazio>
        )}
      </div>

      {podeEditar && (
        <>
          <DialogoConta
            aberto={aberto === "conta"}
            aoFechar={fechar}
            acao={adicionarConta.bind(null, pessoaId, revalidar)}
            nome={nome}
            documento={documento}
            quem={quem}
            bancos={bancos}
            primeira={!contas.length}
          />
          <DialogoInclusao
            aberto={aberto === "pix"}
            aoFechar={fechar}
            titulo="Adicionar chave Pix"
            botao="Adicionar chave"
            sucesso="Chave Pix adicionada."
            acao={adicionarPix.bind(null, pessoaId, revalidar)}
          >
            {(c) => (
              <>
                <Campo
                  classe="f4"
                  id="pix-tipo"
                  label="Tipo da chave"
                  controle={
                    <select
                      id="pix-tipo"
                      name="tipo"
                      defaultValue={pj ? "cnpj" : "cpf"}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        const chave = e.currentTarget.form?.elements.namedItem("chave") as HTMLInputElement | null;
                        if (!chave) return;
                        const t = e.currentTarget.value;
                        chave.value = t === "cpf" && !pj ? formato.cpf(documento) : t === "cnpj" && pj ? formato.cnpj(documento) : "";
                        chave.focus();
                      }}
                    >
                      <Opcoes mapa={ROT.tipo_chave_pix} />
                    </select>
                  }
                />
                <Campo classe="f8" id="pix-chave" name="chave" label="Chave" className="cod" maxLength={77} defaultValue={doc(documento)} autoComplete="off" erro={c.chave} />
                <Campo
                  classe="f12"
                  id="pix-conta"
                  label="Conta ligada"
                  erro={c.conta_id}
                  ajuda={contas.length ? "O financeiro confere se a chave cai na conta indicada." : "Cadastre uma conta antes para poder ligar a chave a ela."}
                  controle={
                    <select id="pix-conta" name="conta_id" defaultValue={contas.find((k) => k.principal)?.id ?? ""}>
                      <option value="">Sem conta ligada</option>
                      {contas.map((k) => (
                        <option key={k.id} value={k.id}>
                          {contaTxt(k)}
                        </option>
                      ))}
                    </select>
                  }
                />
                <Campo classe="f12" id="pix-descricao" name="descricao" label="Descrição" opcional maxLength={30} autoComplete="off" erro={c.descricao} />
                <div className="f12">
                  <Marcar id="pix-principal" name="principal" marcado={!pix.length}>
                    Chave principal
                  </Marcar>
                </div>
              </>
            )}
          </DialogoInclusao>
        </>
      )}
    </>
  );
}

function DialogoConta({
  aberto,
  aoFechar,
  acao,
  nome,
  documento,
  quem,
  bancos,
  primeira,
}: {
  aberto: boolean;
  aoFechar: () => void;
  acao: (f: FormData) => ReturnType<typeof adicionarConta>;
  nome: string;
  documento: string;
  quem: Quem;
  bancos: BancoLinha[];
  primeira: boolean;
}) {
  const [outro, setOutro] = useState(false);
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) setOutro(false);
  }

  return (
    <DialogoInclusao aberto={aberto} aoFechar={aoFechar} titulo="Adicionar conta bancária" botao="Adicionar conta" sucesso="Conta adicionada." acao={acao}>
      {(c) => (
        <>
          <Campo
            classe="f8"
            id="conta-banco"
            label="Banco"
            erro={c.banco_codigo}
            controle={
              <select id="conta-banco" name="banco_codigo" defaultValue="">
                <option value="">Selecione</option>
                {bancos.map((b) => (
                  <option key={b.codigo} value={b.codigo}>
                    {b.codigo} {b.nome}
                  </option>
                ))}
              </select>
            }
          />
          <Campo
            classe="f4"
            id="conta-tipo"
            label="Tipo"
            controle={
              <select id="conta-tipo" name="tipo" defaultValue="corrente">
                <Opcoes mapa={ROT.tipo_conta} />
              </select>
            }
          />
          <Campo classe="f4" id="conta-agencia" name="agencia" label="Agência" className="cod" inputMode="numeric" maxLength={5} autoComplete="off" erro={c.agencia} />
          <Campo classe="f2" id="conta-agencia-dig" name="agencia_digito" label="Dígito" className="cod" maxLength={2} autoComplete="off" />
          <Campo classe="f4" id="conta-conta" name="conta" label="Conta" className="cod" inputMode="numeric" maxLength={20} autoComplete="off" erro={c.conta} />
          <Campo classe="f2" id="conta-conta-dig" name="conta_digito" label="Dígito" className="cod" maxLength={2} autoComplete="off" />
          <Campo classe="f8" id="conta-favorecido" name="favorecido_nome" label="Favorecido" defaultValue={nome} autoComplete="off" />
          <Campo
            classe="f4"
            id="conta-favorecido-doc"
            name="favorecido_documento"
            label="CPF ou CNPJ do favorecido"
            className="cod"
            inputMode="numeric"
            defaultValue={doc(documento)}
            autoComplete="off"
            erro={c.favorecido_documento}
            onChange={(e) => {
              const d = validacao.soDigitos(e.currentTarget.value);
              setOutro(Boolean(d) && d !== documento);
            }}
          />
          <div className="f12">
            {outro && (
              <div className="aviso aviso-pendente">
                <TriangleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
                <span>
                  O favorecido não é {quem.o}. A conta será marcada como “titular não confere” até o financeiro conferir
                  a autorização.
                </span>
              </div>
            )}
          </div>
          <div className="f12">
            <Marcar id="conta-principal" name="principal" marcado={primeira}>
              Conta principal para pagamento
            </Marcar>
          </div>
        </>
      )}
    </DialogoInclusao>
  );
}
