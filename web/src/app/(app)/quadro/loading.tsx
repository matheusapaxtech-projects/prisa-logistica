import { COLUNAS } from "@/lib/quadro";

/* Esqueleto do Quadro: mesmo título, filtros e as 10 colunas com os rótulos do usuário, com barras no
   lugar dos cartões. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoQuadro() {
  return (
    <main className="quadro-pagina" aria-busy="true" aria-label="Carregando o quadro">
      <div className="titulo">
        <div>
          <h1>Quadro da operação</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={320} h={14} />
          </p>
        </div>
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        {[170, 170, 170, 130, 110].map((w, i) => (
          <Barra key={i} w={w} h={32} r={6} />
        ))}
      </div>
      <div className="quadro carregando" aria-hidden="true">
        {COLUNAS.map((c, n) => (
          <section key={c.status} className={`quadro-coluna${n === 0 ? " ativa" : ""}`}>
            <header className="quadro-coluna-cab">
              <h2>{c.rotulo}</h2>
            </header>
            <div className="quadro-coluna-corpo">
              {Array.from({ length: n % 3 === 0 ? 2 : 1 }, (_, i) => (
                <div key={i} className="quadro-cartao">
                  <Barra w={92} h={30} r={4} />
                  <Barra w="70%" />
                  <Barra w="55%" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
