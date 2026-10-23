/* Marca de validade (`marcaValidade` de motoristas.js): a data só ganha forma e cor quando vence em
   até 30 dias ou já venceu. Sem estado: serve a Server e a Client Components. */
import { estadoValidade } from "@/lib/datas";
import { formato } from "@/lib/formato";

export function MarcaValidade({ iso, prefixo = "" }: { iso: string | null | undefined; prefixo?: string }) {
  if (!iso) return <span className="dash">—</span>;
  const e = estadoValidade(iso);
  return (
    <span className={`val${e.cls === "normal" || e.cls === "neutro" ? "" : ` val-${e.cls}`}`}>
      {prefixo}
      {formato.data(iso)}
    </span>
  );
}
