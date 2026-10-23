import { Barra } from "../conjuntos/barra";
import "@/styles/paginas/conjuntos.css";

/* Esqueleto das pendências: título, abas, filtro e os grupos (cabeçalho com o sinal de 44 px e linhas de 64 px). */
export default function CarregandoPendencias() {
  return (
    <main aria-busy="true" aria-label="Carregando as pendências">
      <div className="titulo">
        <div>
          <h1>Pendências</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={480} h={14} />
          </p>
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12, display: "flex", gap: 24 }}>
        <Barra w={110} h={14} />
        <Barra w={110} h={14} />
        <Barra w={110} h={14} />
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={280} h={32} r={6} />
      </div>
      <div className="grupos carregando" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <section className="grupo-pend" key={n}>
            <div className="grupo-cab">
              <Barra w={44} h={44} r="50%" />
              <div>
                <Barra w={220} h={16} />
                <br />
                <Barra w="60%" />
              </div>
            </div>
            <div className="grupo-corpo">
              {[0, 1].map((k) => (
                <div className="pend-linha" key={k}>
                  <Barra w="80%" h={28} r={6} />
                  <Barra w="70%" h={14} />
                  <Barra w={150} h={32} r={6} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
