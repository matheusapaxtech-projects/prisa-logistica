import Link from "next/link";

/** Quem só consulta (financeiro, leitura) não monta conjunto: o banco recusaria. */
export function SemPermissao({ titulo }: { titulo: string }) {
  return (
    <main>
      <div className="titulo">
        <div>
          <div className="migalha">
            <Link href="/conjuntos">Conjuntos</Link>
            <span className="sep">/</span>
            <h1>{titulo}</h1>
          </div>
        </div>
      </div>
      <div className="vazio-bloco">
        Seu papel permite consultar os conjuntos, mas não montar nem trocar peças.{" "}
        <Link className="btn btn-texto" href="/conjuntos">
          Ver conjuntos
        </Link>
      </div>
    </main>
  );
}
