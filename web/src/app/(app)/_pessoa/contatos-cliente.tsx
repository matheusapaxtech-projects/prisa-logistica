"use client";

import { useState, type ChangeEvent, type MouseEvent } from "react";
import { Search } from "lucide-react";
import { Campo } from "@/components/Campo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { formato, mascaras } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import { adicionarEmail, adicionarEndereco, adicionarTelefone } from "./actions";
import type { Email, Endereco, Telefone } from "./consultas";
import { DialogoInclusao } from "./dialogo-inclusao";
import { BotaoAdicionar, CabPainel, Dash, Marca, Marcar, Opcoes, OpcoesUf } from "./partes";
import { ROT, rotulo } from "./rotulos";

export type TextosContatos = { enderecos: string; telefones: string; emails: string };

type Props = {
  pessoaId: string;
  enderecos: Endereco[];
  telefones: Telefone[];
  emails: Email[];
  podeEditar: boolean;
  revalidar: string[];
  textos: TextosContatos;
};

type Dialogo = "endereco" | "telefone" | "email" | null;

/* Aba Contatos (renderContatos + diálogos endereço/telefone/e-mail de prototipo/motorista.html).
   Cada inclusão grava na hora. */
export function ContatosPainel({ pessoaId, enderecos, telefones, emails, podeEditar, revalidar, textos }: Props) {
  const [aberto, setAberto] = useState<Dialogo>(null);
  const fechar = () => setAberto(null);

  return (
    <>
      <div className="subsecao">
        <CabPainel titulo="Endereços">
          {podeEditar && <BotaoAdicionar onClick={() => setAberto("endereco")}>Adicionar endereço</BotaoAdicionar>}
        </CabPainel>
        {enderecos.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">Endereço</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">CEP</th>
                  <th scope="col">
                    <span className="sr-only">Marcas</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {enderecos.map((e) => (
                  <tr key={e.id}>
                    <td className="cel-1">
                      <span className="id">
                        {e.logradouro}
                        {e.numero ? `, ${e.numero}` : ""}
                        {e.complemento && (
                          <>
                            <Ponto />
                            {e.complemento}
                          </>
                        )}
                      </span>
                      <span className="linha2">
                        {e.bairro && (
                          <>
                            {e.bairro}
                            <Ponto />
                          </>
                        )}
                        {e.cidade}/{e.uf}
                        {e.ponto_referencia && (
                          <>
                            <Ponto />
                            {e.ponto_referencia}
                          </>
                        )}
                      </span>
                    </td>
                    <td>{rotulo(ROT.tipo_endereco, e.tipo) ?? <Dash />}</td>
                    <td>
                      <span className="cod">{e.cep ? formato.cep(e.cep) : "—"}</span>
                    </td>
                    <td className="acoes-linha">{e.principal && <Marca icone="star">Principal</Marca>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>{textos.enderecos}</EstadoVazio>
        )}
      </div>

      <div className="subsecao">
        <CabPainel titulo="Telefones">
          {podeEditar && <BotaoAdicionar onClick={() => setAberto("telefone")}>Adicionar telefone</BotaoAdicionar>}
        </CabPainel>
        {telefones.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">Número</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Contato</th>
                  <th scope="col">
                    <span className="sr-only">Marcas</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {telefones.map((t) => (
                  <tr key={t.id}>
                    <td className="cel-1">
                      <span className="id num">{formato.telefone(t.numero)}</span>
                      {t.ramal && <span className="linha2">ramal {t.ramal}</span>}
                    </td>
                    <td>{rotulo(ROT.tipo_telefone, t.tipo) ?? <Dash />}</td>
                    <td>{t.contato || <Dash />}</td>
                    <td className="acoes-linha">
                      {t.whatsapp && <Marca icone="message-circle">WhatsApp</Marca>}
                      {t.principal && <Marca icone="star">Principal</Marca>}
                      {t.restrito && <Marca icone="lock">Restrito</Marca>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>{textos.telefones}</EstadoVazio>
        )}
      </div>

      <div className="subsecao">
        <CabPainel titulo="E-mails">
          {podeEditar && <BotaoAdicionar onClick={() => setAberto("email")}>Adicionar e-mail</BotaoAdicionar>}
        </CabPainel>
        {emails.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">E-mail</th>
                  <th scope="col">Observação</th>
                  <th scope="col">
                    <span className="sr-only">Marcas</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {emails.map((m) => (
                  <tr key={m.id}>
                    <td className="cel-1">
                      <span className="id">{m.email}</span>
                    </td>
                    <td>{m.observacao || <Dash />}</td>
                    <td className="acoes-linha">
                      {m.recebe_cte && <Marca icone="file-text">Recebe CT-e</Marca>}
                      {m.principal && <Marca icone="star">Principal</Marca>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>{textos.emails}</EstadoVazio>
        )}
      </div>

      {podeEditar && (
        <>
          <DialogoEndereco
            aberto={aberto === "endereco"}
            aoFechar={fechar}
            acao={adicionarEndereco.bind(null, pessoaId, revalidar)}
            primeiro={!enderecos.length}
          />
          <DialogoInclusao
            aberto={aberto === "telefone"}
            aoFechar={fechar}
            titulo="Adicionar telefone"
            botao="Adicionar telefone"
            sucesso="Telefone adicionado."
            acao={adicionarTelefone.bind(null, pessoaId, revalidar)}
          >
            {(c) => (
              <>
                <Campo classe="f8" id="tel-numero" name="numero" label="Número" mascara="telefone" placeholder="(00) 00000-0000" autoComplete="off" erro={c.numero} />
                <Campo classe="f4" id="tel-ramal" name="ramal" label="Ramal" opcional maxLength={4} inputMode="numeric" autoComplete="off" erro={c.ramal} />
                <Campo
                  classe="f6"
                  id="tel-tipo"
                  label="Tipo"
                  controle={
                    <select id="tel-tipo" name="tipo" defaultValue="celular">
                      <Opcoes mapa={ROT.tipo_telefone} />
                    </select>
                  }
                />
                <Campo classe="f6" id="tel-contato" name="contato" label="Contato" opcional maxLength={100} placeholder="Quem atende" autoComplete="off" />
                <div className="f12 marcas">
                  <Marcar id="tel-whatsapp" name="whatsapp" marcado>
                    Tem WhatsApp
                  </Marcar>
                  <Marcar id="tel-principal" name="principal" marcado={!telefones.length}>
                    Principal
                  </Marcar>
                  <Marcar id="tel-restrito" name="restrito">
                    Restrito (só administrador vê)
                  </Marcar>
                </div>
              </>
            )}
          </DialogoInclusao>
          <DialogoInclusao
            aberto={aberto === "email"}
            aoFechar={fechar}
            titulo="Adicionar e-mail"
            botao="Adicionar e-mail"
            sucesso="E-mail adicionado."
            acao={adicionarEmail.bind(null, pessoaId, revalidar)}
          >
            {(c) => (
              <>
                <Campo classe="f12" id="mail-email" name="email" type="email" label="E-mail" placeholder="nome@exemplo.com" autoComplete="off" erro={c.email} />
                <Campo classe="f12" id="mail-observacao" name="observacao" label="Observação" opcional autoComplete="off" />
                <div className="f12 marcas">
                  <Marcar id="mail-principal" name="principal" marcado={!emails.length}>
                    Principal
                  </Marcar>
                  <Marcar id="mail-cte" name="recebe_cte">
                    Recebe CT-e
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

type EstadoCep = { tipo: "inicio" | "buscando" | "achado" | "erro"; texto: string };
const CEP_INICIO: EstadoCep = { tipo: "inicio", texto: "Busca rua, bairro e cidade na BrasilAPI." };

/** Diálogo de endereço, com a busca de CEP (rota /api/cep, BrasilAPI). */
function DialogoEndereco({
  aberto,
  aoFechar,
  acao,
  primeiro,
}: {
  aberto: boolean;
  aoFechar: () => void;
  acao: (f: FormData) => ReturnType<typeof adicionarEndereco>;
  primeiro: boolean;
}) {
  const [cep, setCep] = useState<EstadoCep>(CEP_INICIO);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setCep(CEP_INICIO);
      setErroCep(null);
    }
  }

  async function buscar(form: HTMLFormElement | null) {
    if (!form) return;
    const el = form.elements.namedItem("cep") as HTMLInputElement;
    const d = validacao.soDigitos(el.value);
    if (d.length !== 8) {
      setErroCep("Digite os 8 dígitos do CEP para buscar.");
      return;
    }
    setErroCep(null);
    setCep({ tipo: "buscando", texto: "Consultando o CEP…" });
    try {
      const r = await fetch(`/api/cep/${d}`, { cache: "no-store" });
      const j = (await r.json()) as { erro?: string; logradouro?: string; bairro?: string; cidade?: string; uf?: string };
      if (!r.ok || j.erro) throw new Error(j.erro || "A consulta não respondeu.");
      for (const k of ["logradouro", "bairro", "cidade"] as const) {
        const campo = form.elements.namedItem(k) as HTMLInputElement | null;
        if (campo && j[k]) campo.value = j[k]!;
      }
      const uf = form.elements.namedItem("uf") as HTMLSelectElement | null;
      if (uf && j.uf) uf.value = j.uf;
      setCep({ tipo: "achado", texto: `Encontrado: ${j.cidade}/${j.uf}. Confira o número.` });
      (form.elements.namedItem("numero") as HTMLInputElement | null)?.focus();
    } catch (e) {
      setCep({ tipo: "erro", texto: (e as Error).message || "A consulta não respondeu." });
    }
  }

  function aoDigitarCep(e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    el.value = mascaras.cep(el.value);
    if (erroCep) setErroCep(null);
    if (validacao.soDigitos(el.value).length === 8) void buscar(el.form);
  }

  return (
    <DialogoInclusao
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Adicionar endereço"
      botao="Adicionar endereço"
      sucesso="Endereço adicionado."
      acao={acao}
    >
      {(c) => (
        <>
          <Campo
            classe="f6"
            id="end-cep"
            label="CEP"
            erro={erroCep ?? c.cep}
            ajuda={
              <span>
                {cep.texto}
                {cep.tipo === "erro" && (
                  <>
                    {" "}Preencha à mão ou{" "}
                    <button
                      type="button"
                      className="btn-link"
                      onClick={(e: MouseEvent<HTMLButtonElement>) => void buscar(e.currentTarget.form)}
                    >
                      tente de novo
                    </button>
                    .
                  </>
                )}
              </span>
            }
            controle={
              <div className="com-acao">
                <input
                  id="end-cep"
                  name="cep"
                  className="cod"
                  inputMode="numeric"
                  placeholder="00000-000"
                  autoComplete="off"
                  onChange={aoDigitarCep}
                />
                <button className="btn" type="button" onClick={(e) => void buscar(e.currentTarget.form)}>
                  <Search size={16} strokeWidth={1.6} aria-hidden="true" />
                  Buscar
                </button>
              </div>
            }
          />
          <Campo
            classe="f6"
            id="end-tipo"
            label="Tipo"
            controle={
              <select id="end-tipo" name="tipo" defaultValue="residencial">
                <Opcoes mapa={ROT.tipo_endereco} />
              </select>
            }
          />
          <Campo classe="f9" id="end-logradouro" name="logradouro" label="Rua ou avenida" autoComplete="off" erro={c.logradouro} />
          <Campo classe="f3" id="end-numero" name="numero" label="Número" placeholder="s/n" autoComplete="off" erro={c.numero} />
          <Campo classe="f6" id="end-complemento" name="complemento" label="Complemento" opcional autoComplete="off" />
          <Campo classe="f6" id="end-bairro" name="bairro" label="Bairro" autoComplete="off" />
          <Campo classe="f9" id="end-cidade" name="cidade" label="Cidade" autoComplete="off" erro={c.cidade} />
          <Campo
            classe="f3"
            id="end-uf"
            label="UF"
            erro={c.uf}
            controle={
              <select id="end-uf" name="uf" defaultValue="">
                <OpcoesUf />
              </select>
            }
          />
          <Campo classe="f12" id="end-ponto" name="ponto_referencia" label="Ponto de referência" opcional autoComplete="off" />
          <Campo
            classe="f12"
            id="end-coordenada"
            name="coordenada"
            label="Coordenada"
            opcional
            placeholder="-23.551234,-51.461234 ou link do Google Maps"
            autoComplete="off"
          />
          <div className="f12">
            <Marcar id="end-principal" name="principal" marcado={primeiro}>
              Endereço principal
            </Marcar>
          </div>
        </>
      )}
    </DialogoInclusao>
  );
}
