/* Pedaços de marcação das fichas (helpers `cab`, `marca`, `opcoesSelect`, `opcoesUf` de
   prototipo/motorista.html). Sem estado: servem a Server e a Client Components. */
import type { ReactNode } from "react";
import { FileText, Lock, MessageCircle, Plus, Star, type LucideIcon } from "lucide-react";
import { UFS } from "./rotulos";

const ICONES = { star: Star, lock: Lock, "message-circle": MessageCircle, "file-text": FileText } satisfies Record<string, LucideIcon>;

/** `.marca-texto`: ícone + texto curto (Principal, WhatsApp, Restrito, Recebe CT-e). */
export function Marca({ icone, children }: { icone: keyof typeof ICONES; children: ReactNode }) {
  const Icone = ICONES[icone];
  return (
    <span className="marca-texto">
      <Icone size={16} strokeWidth={1.6} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Cabeçalho de painel (`.painel-cab`) com o título e, à direita, um botão ou nota. */
export function CabPainel({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="painel-cab">
      <h2>{titulo}</h2>
      {children && <span className="dir">{children}</span>}
    </div>
  );
}

/** Botão "+ Adicionar …" dos painéis. */
export function BotaoAdicionar({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="btn" type="button" onClick={onClick}>
      <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
      {children}
    </button>
  );
}

/** Travessão de valor vazio. */
export function Dash({ children = "—" }: { children?: ReactNode }) {
  return <span className="dash">{children}</span>;
}

/** `<option>`s de um mapa de rótulos, com a opção vazia opcional. */
export function Opcoes({ mapa, vazio }: { mapa: Record<string, string>; vazio?: string }) {
  return (
    <>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {Object.entries(mapa).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </>
  );
}

/** `<option>`s das UFs, com "UF" vazio no topo. */
export function OpcoesUf() {
  return (
    <>
      <option value="">UF</option>
      {UFS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </>
  );
}

/** Caixa de marcar (`.marcar`) com o rótulo ao lado. */
export function Marcar({ id, name, children, marcado }: { id: string; name: string; children: ReactNode; marcado?: boolean }) {
  return (
    <label className="marcar" htmlFor={id}>
      <input type="checkbox" id={id} name={name} defaultChecked={marcado} />
      {children}
    </label>
  );
}
