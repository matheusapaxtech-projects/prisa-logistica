import { Barra } from "../barra";
import "@/styles/paginas/conjuntos.css";

/* Esqueleto do montador: título, prévia do engate e as seções (cavalo com a lista de cavalos, peças, capacidade). */
export default function CarregandoMontador() {
  return (
    <main aria-busy="true" aria-label="Carregando o montador">
      <div className="titulo">
        <div>
          <div className="migalha">
            <span>Conjuntos</span>
            <span className="sep">/</span>
            <h1>Montar conjunto</h1>
          </div>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={520} h={14} />
          </p>
        </div>
      </div>
      <div className="previa" style={{ height: 112, marginBottom: 40 }} aria-hidden="true" />
      <div className="montador carregando" aria-hidden="true">
        {["Cavalo", "Peças em ordem de engate", "Capacidade"].map((t, i) => (
          <section className="secao" key={t}>
            <div className="secao-rotulo">
              <h2>{t}</h2>
              <p>
                <Barra w="90%" />
              </p>
            </div>
            <div>
              {Array.from({ length: i === 0 ? 5 : 2 }, (_, n) => (
                <div key={n} style={{ padding: "10px 0" }}>
                  <Barra w="100%" h={36} r={6} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
