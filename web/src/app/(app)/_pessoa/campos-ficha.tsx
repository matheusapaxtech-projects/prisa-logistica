/* Peças de marcação dos formulários das fichas (seção com rótulo à esquerda, grupo de opções,
   sim/não, caixa de marcar, seleção, UF com travessão). Sem estado: usadas pelos formulários
   (Client Components) de proprietário e de cliente. */
import type { ChangeEvent, ReactNode } from "react";
import { Campo } from "@/components/Campo";
import { UFS } from "./rotulos";

/** " (opcional)" depois do rótulo. */
export const opc = (
  <>
    {" "}
    <span className="opcional">(opcional)</span>
  </>
);

/** Valor do banco (true/false/null) para o rádio sim/não. */
export const simNao = (b: boolean | null) => (b === true ? "sim" : b === false ? "nao" : "");

export function Secao({ id, titulo, texto, children, depois }: { id: string; titulo: string; texto?: string; children?: ReactNode; depois?: ReactNode }) {
  return (
    <section className="secao" aria-labelledby={id}>
      <div className="secao-rotulo">
        <h2 id={id}>{titulo}</h2>
        {texto && <p>{texto}</p>}
      </div>
      <div>
        {children && <div className="campos">{children}</div>}
        {depois}
      </div>
    </section>
  );
}

export function Grupo({ classe, id, rotulo, children, ajuda, erro }: { classe: string; id: string; rotulo: string; children: ReactNode; ajuda?: ReactNode; erro?: string }) {
  return (
    <div className={`campo ${classe}`}>
      <span className="rotulo" id={id}>
        {rotulo}
      </span>
      <div className="opcoes" role="radiogroup" aria-labelledby={id}>
        {children}
      </div>
      {ajuda && <span className="ajuda">{ajuda}</span>}
      {erro && <span className="erro">{erro}</span>}
    </div>
  );
}

export function Radio({ nome, valor, atual, desabilitado, children }: { nome: string; valor: string; atual: string; desabilitado?: boolean; children: ReactNode }) {
  return (
    <label className="opcao">
      <input type="radio" name={nome} value={valor} defaultChecked={valor === atual} disabled={desabilitado} />
      <span>{children}</span>
    </label>
  );
}

export function SimNao({ nome, atual }: { nome: string; atual: string }) {
  return (
    <>
      <Radio nome={nome} valor="sim" atual={atual}>
        Sim
      </Radio>
      <Radio nome={nome} valor="nao" atual={atual}>
        Não
      </Radio>
    </>
  );
}

export function Checar({ nome, rotulo, marcado, classe, onChange }: { nome: string; rotulo: string; marcado: boolean; classe: string; onChange?: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className={`campo ${classe}`}>
      <span className="rotulo" aria-hidden="true">
        &nbsp;
      </span>
      <label className="checar">
        <input type="checkbox" id={nome} name={nome} defaultChecked={marcado} onChange={onChange} />
        {rotulo}
      </label>
    </div>
  );
}

export function Selecao({ classe, nome, rotulo, valor, children, erro }: { classe: string; nome: string; rotulo: ReactNode; valor: string | null; children: ReactNode; erro?: string }) {
  return (
    <Campo
      classe={classe}
      id={nome}
      label={rotulo}
      erro={erro}
      controle={
        <select id={nome} name={nome} defaultValue={valor ?? ""}>
          {children}
        </select>
      }
    />
  );
}

export const OpcoesUfTraco = () => (
  <>
    <option value="">—</option>
    {UFS.map((u) => (
      <option key={u} value={u}>
        {u}
      </option>
    ))}
  </>
);
