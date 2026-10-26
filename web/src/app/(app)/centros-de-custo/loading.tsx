import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/centros.css";

/* Esqueleto dos centros de custo: mesmo título, com barras no lugar da lista. */
function Barra({ w, h = 12 }: { w: number | string; h?: number }) {
  return <i style={{ width: w, height: h }} />;
}

export default function CarregandoCentros() {
  return (
    <main className="prop centros" aria-busy="true" aria-label="Carregando os centros de custo">
      <div className="titulo">
        <div>
          <h1>Centros de custo</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={220} h={14} />
          </p>
        </div>
      </div>
      <div className="bloco bloco-corpo carregando" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <p key={i} className="linha-carregando">
            <Barra w={60} h={14} />
            <Barra w={220} h={14} />
          </p>
        ))}
      </div>
    </main>
  );
}
