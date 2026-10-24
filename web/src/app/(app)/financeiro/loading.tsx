import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/financeiro.css";

/* Esqueleto do Financeiro: mesmo título e abas, com barras no lugar do resultado. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoFinanceiro() {
  return (
    <main className="prop fin" aria-busy="true" aria-label="Carregando o financeiro">
      <div className="titulo">
        <div>
          <h1>Financeiro</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={280} h={14} />
          </p>
        </div>
      </div>
      <div className="mes-nav carregando" aria-hidden="true">
        <Barra w={200} h={32} r={6} />
      </div>
      <div className="grade carregando" aria-hidden="true">
        <div className="bloco c7 bloco-corpo">
          {Array.from({ length: 5 }, (_, i) => (
            <p key={i} className="linha-carregando">
              <Barra w={180} h={14} />
              <Barra w={110} h={14} />
            </p>
          ))}
        </div>
        <div className="bloco c5 bloco-corpo">
          {Array.from({ length: 5 }, (_, i) => (
            <p key={i} className="linha-carregando">
              <Barra w={160} h={14} />
              <Barra w={90} h={14} />
            </p>
          ))}
        </div>
      </div>
    </main>
  );
}
