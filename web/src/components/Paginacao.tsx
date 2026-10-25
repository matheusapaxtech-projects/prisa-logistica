import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PorPagina } from "./por-pagina";

/* Rodapé de lista com páginas: "Mostrando 26–50 de 132 viagens", quantas por página e o seletor de
   páginas (anterior, números com "…", próxima). Tudo por link (a página da lista lê `?pagina=`), então
   funciona sem JavaScript, menos a troca de "por página", que é um seletor. No celular, só
   anterior, "2 de 6" e próxima. */

type Props = {
  pagina: number;
  paginas: number;
  inicio: number;
  fim: number;
  total: number;
  /** Nome do que a lista conta, no plural (ex.: "viagens"). */
  plural: string;
  /** Números a mostrar (ver `numerosDePagina`). */
  numeros: (number | "…")[];
  /** Endereço de cada página. */
  href: (pagina: number) => string;
  porPagina: number;
  /** Endereço de cada opção de "por página" (volta para a página 1). */
  porPaginaHrefs: Record<number, string>;
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function Paginacao({ pagina, paginas, inicio, fim, total, plural, numeros, href, porPagina, porPaginaHrefs }: Props) {
  if (total === 0) return null;
  const anterior = pagina > 1 ? href(pagina - 1) : null;
  const proxima = pagina < paginas ? href(pagina + 1) : null;
  return (
    <div className="paginacao">
      <p className="paginacao-conta">
        Mostrando{" "}
        <strong>
          {fmt(inicio)}–{fmt(fim)}
        </strong>{" "}
        de {fmt(total)} {plural}
      </p>
      <PorPagina atual={porPagina} hrefs={porPaginaHrefs} />
      {paginas > 1 && (
        <nav className="paginacao-paginas" aria-label="Páginas">
          {anterior ? (
            <Link className="btn btn-icone" href={anterior} scroll={false} aria-label="Página anterior">
              <ChevronLeft aria-hidden="true" />
            </Link>
          ) : (
            <span className="btn btn-icone" aria-disabled="true" aria-label="Página anterior">
              <ChevronLeft aria-hidden="true" />
            </span>
          )}
          {numeros.map((n, i) =>
            n === "…" ? (
              <span key={`r${i}`} className="paginacao-reticencias" aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                key={n}
                className="btn btn-icone paginacao-numero"
                href={href(n)}
                scroll={false}
                aria-label={`Página ${n}`}
                aria-current={n === pagina ? "page" : undefined}
              >
                {n}
              </Link>
            ),
          )}
          <span className="paginacao-de" aria-hidden="true">
            {pagina} de {paginas}
          </span>
          {proxima ? (
            <Link className="btn btn-icone" href={proxima} scroll={false} aria-label="Próxima página">
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <span className="btn btn-icone" aria-disabled="true" aria-label="Próxima página">
              <ChevronRight aria-hidden="true" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
