import { Barra } from "../barra";
import "@/styles/paginas/conjuntos.css";

/* Esqueleto da ficha: título com migalha, bloco do engate (desenho + 4 linhas) e os blocos de capacidade e motorista. */
export default function CarregandoConjunto() {
  return (
    <main aria-busy="true" aria-label="Carregando o conjunto">
      <div className="titulo">
        <div>
          <div className="migalha carregando" aria-hidden="true">
            <Barra w={90} h={16} />
            <Barra w={320} h={20} />
          </div>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={380} h={14} />
          </p>
        </div>
      </div>
      <div className="grade carregando" aria-hidden="true">
        <section className="bloco c12">
          <div className="bloco-cab">
            <h2>Engate</h2>
          </div>
          <div className="bloco-corpo">
            <div className="previa" style={{ height: 112 }} />
            {[0, 1, 2, 3].map((n) => (
              <div key={n} style={{ display: "flex", gap: 24, padding: "14px 0", borderTop: n ? "1px solid var(--rule)" : 0 }}>
                <Barra w={60} h={14} />
                <Barra w={96} h={24} r={4} />
                <Barra w="30%" h={14} />
              </div>
            ))}
          </div>
        </section>
        <section className="bloco c7">
          <div className="bloco-cab">
            <h2>Capacidade</h2>
          </div>
          <div className="bloco-corpo">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} style={{ padding: "4px 0" }}>
                <Barra w="100%" h={14} />
              </div>
            ))}
            <Barra w="100%" h={8} r={4} />
          </div>
        </section>
        <section className="bloco c5">
          <div className="bloco-cab">
            <h2>Motorista</h2>
          </div>
          <div className="bloco-corpo">
            <Barra w={40} h={40} r="50%" /> <Barra w={180} h={14} />
            {[0, 1, 2, 3].map((n) => (
              <div key={n} style={{ padding: "6px 0" }}>
                <Barra w="80%" h={14} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
