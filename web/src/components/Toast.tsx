"use client";

import { useSyncExternalStore } from "react";
import {
  Check,
  CircleAlert,
  Eye,
  FileText,
  Info,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";

/** Ícones de aviso usados no protótipo (`N.toast(msg, icone)`). */
const ICONES = {
  check: Check,
  "alert-circle": CircleAlert,
  "circle-alert": CircleAlert,
  eye: Eye,
  "file-text": FileText,
  info: Info,
  paperclip: Paperclip,
  plus: Plus,
  "trash-2": Trash2,
  upload: Upload,
} satisfies Record<string, LucideIcon>;

export type IconeToast = keyof typeof ICONES;

type Aviso = { id: number; msg: string; icone: IconeToast; saindo: boolean };

/* Store de módulo: `toast()` pode ser chamado de qualquer Client Component (ou handler) sem contexto. */
let avisos: Aviso[] = [];
let proximo = 1;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const SEM_AVISOS: Aviso[] = [];

/** Mesmo tempo do protótipo: 3,2 s visível, 320 ms para sair. */
const VISIVEL_MS = 3200;
const SAIDA_MS = 320;

/** Aviso rápido no canto (`N.toast`). Precisa do `<Toaster />` montado (o Shell monta um). */
export function toast(msg: string, icone: IconeToast = "check"): void {
  const id = proximo++;
  avisos = [...avisos, { id, msg, icone, saindo: false }];
  avisar();
  setTimeout(() => {
    avisos = avisos.map((a) => (a.id === id ? { ...a, saindo: true } : a));
    avisar();
    setTimeout(() => {
      avisos = avisos.filter((a) => a.id !== id);
      avisar();
    }, SAIDA_MS);
  }, VISIVEL_MS);
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** A pilha de avisos (`.toasts`, aria-live). Monte uma vez (no Shell). */
export function Toaster() {
  const lista = useSyncExternalStore(
    assinar,
    () => avisos,
    () => SEM_AVISOS,
  );
  return (
    <div className="toasts" aria-live="polite">
      {lista.map((a) => {
        const Icone = ICONES[a.icone];
        return (
          <div
            key={a.id}
            className="toast"
            style={a.saindo ? { opacity: 0, transform: "translateY(8px)" } : undefined}
          >
            <Icone size={16} strokeWidth={1.6} aria-hidden="true" />
            <span>{a.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
