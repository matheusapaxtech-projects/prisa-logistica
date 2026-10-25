"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
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

/** Botão do aviso (ex.: "Desfazer"). Clicar executa e fecha o aviso. */
export type AcaoToast = { rotulo: string; aoClicar: () => void };

type Aviso = { id: number; msg: string; icone: IconeToast; acao?: AcaoToast };

/* Store de módulo: `toast()` pode ser chamado de qualquer Client Component (ou handler) sem contexto. */
let avisos: Aviso[] = [];
let proximo = 1;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const SEM_AVISOS: Aviso[] = [];

/** 3,2 s visível; com botão (Desfazer), 6 s para dar tempo de clicar. */
const VISIVEL_MS = 3200;
const VISIVEL_ACAO_MS = 6000;
/** No máximo dois avisos empilhados: o mais antigo sai quando chega o terceiro. */
const MAXIMO = 2;

function remover(id: number) {
  if (!avisos.some((a) => a.id === id)) return;
  avisos = avisos.filter((a) => a.id !== id);
  avisar();
}

/** Aviso rápido embaixo, no centro (`N.toast`). Precisa do `<Toaster />` montado (o Shell monta um). */
export function toast(msg: string, icone: IconeToast = "check", opcoes?: { acao?: AcaoToast }): void {
  const id = proximo++;
  avisos = [...avisos, { id, msg, icone, acao: opcoes?.acao }].slice(-MAXIMO);
  avisar();
  setTimeout(() => remover(id), opcoes?.acao ? VISIVEL_ACAO_MS : VISIVEL_MS);
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const ERRO: ReadonlySet<IconeToast> = new Set(["alert-circle", "circle-alert"]);

/** A pilha de avisos (`.toasts`, aria-live): pílula escura que sobe com mola. Monte uma vez (no Shell). */
export function Toaster() {
  const lista = useSyncExternalStore(
    assinar,
    () => avisos,
    () => SEM_AVISOS,
  );
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {lista.map((a) => {
          const Icone = ICONES[a.icone];
          return (
            <motion.div
              key={a.id}
              layout
              className={`toast${a.acao ? " com-acao" : ""}`}
              initial={{ opacity: 0, y: 28, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
            >
              <span className={`toast-marca${ERRO.has(a.icone) ? " erro" : ""}`} aria-hidden="true">
                <Icone size={13} strokeWidth={2.4} />
              </span>
              <span>{a.msg}</span>
              {a.acao && (
                <button
                  type="button"
                  className="toast-acao"
                  onClick={() => {
                    remover(a.id);
                    a.acao?.aoClicar();
                  }}
                >
                  {a.acao.rotulo}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
