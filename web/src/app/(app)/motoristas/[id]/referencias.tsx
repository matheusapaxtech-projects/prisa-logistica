"use client";

import { useState } from "react";
import { Campo } from "@/components/Campo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { formato } from "@/lib/formato";
import { hojeISO } from "@/lib/datas";
import { DialogoInclusao } from "../../_pessoa/dialogo-inclusao";
import { BotaoAdicionar, CabPainel } from "../../_pessoa/partes";
import { ROT, rotulo } from "../../_pessoa/rotulos";
import { adicionarReferencia } from "../actions";

export type Referencia = {
  id: string;
  tipo: string;
  nome: string;
  telefone: string | null;
  dt_referencia: string | null;
  observacao: string | null;
};

/* Aba Referências (renderReferencias + diálogo de prototipo/motorista.html). */
export function Referencias({ motoristaId, referencias, podeEditar }: { motoristaId: string; referencias: Referencia[]; podeEditar: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="subsecao">
      <CabPainel titulo="Referências pessoais e comerciais">
        {podeEditar && <BotaoAdicionar onClick={() => setAberto(true)}>Adicionar referência</BotaoAdicionar>}
      </CabPainel>
      {referencias.length ? (
        <div className="tabela-wrap">
          <table className="tabela leve empilha">
            <thead>
              <tr>
                <th scope="col">Referência</th>
                <th scope="col">Tipo</th>
                <th scope="col">Telefone</th>
                <th scope="col" className="num">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {referencias.map((r) => (
                <tr key={r.id}>
                  <td className="cel-1">
                    <span className="id">{r.nome}</span>
                    <span className="linha2">{r.observacao || "sem observação"}</span>
                  </td>
                  <td>{rotulo(ROT.tipo_referencia, r.tipo)}</td>
                  <td>
                    <span className="num">{r.telefone ? formato.telefone(r.telefone) : "—"}</span>
                  </td>
                  <td className="num">{formato.data(r.dt_referencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVazio>Nenhuma referência. Peça ao menos uma comercial (última transportadora) antes da primeira carga.</EstadoVazio>
      )}
      {podeEditar && (
        <DialogoInclusao
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          titulo="Adicionar referência"
          botao="Adicionar referência"
          sucesso="Referência adicionada."
          acao={adicionarReferencia.bind(null, motoristaId)}
        >
          {(c) => (
            <>
              <div className="campo f12">
                <span className="rotulo" id="ref-tipo">
                  Tipo
                </span>
                <div className="opcoes" role="radiogroup" aria-labelledby="ref-tipo">
                  <label className="opcao">
                    <input type="radio" name="tipo" value="comercial" defaultChecked />
                    <span>Comercial</span>
                  </label>
                  <label className="opcao">
                    <input type="radio" name="tipo" value="pessoal" />
                    <span>Pessoal</span>
                  </label>
                </div>
              </div>
              <Campo classe="f12" id="ref-nome" name="nome" label="Nome da referência" placeholder="Empresa ou pessoa" autoComplete="off" erro={c.nome} />
              <Campo classe="f6" id="ref-telefone" name="telefone" label="Telefone" mascara="telefone" placeholder="(00) 00000-0000" autoComplete="off" erro={c.telefone} />
              <Campo classe="f6" id="ref-data" name="dt_referencia" type="date" label="Data do contato" defaultValue={hojeISO()} erro={c.dt_referencia} />
              <Campo
                classe="f12"
                id="ref-observacao"
                label="Observação"
                opcional
                erro={c.observacao}
                controle={<textarea id="ref-observacao" name="observacao" rows={3} placeholder="O que a referência disse" />}
              />
            </>
          )}
        </DialogoInclusao>
      )}
    </div>
  );
}
