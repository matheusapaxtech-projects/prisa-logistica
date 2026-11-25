import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/financeiro.css";
import "@/styles/paginas/contas.css";

/* Esqueleto das contas a receber: mesmo título e abas, com barras no lugar da lista. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoContasReceber() {
  return (
    <main className="prop fin contas" aria-busy="true" aria-label="Carregando as contas a receber">
      <div className="titulo">
        <div>
          <h1>Contas a receber</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={280} h={14} />
          </p>
        </div>
      </div>
      <div className="mes-nav carregando" aria-hidden="true">
        <Barra w={320} h={32} r={999} />
      </div>
      <div className="bloco bloco-corpo carregando" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <p key={i} className="linha-carregando">
            <Barra w={240} h={14} />
            <Barra w={110} h={14} />
          </p>
        ))}
      </div>
    </main>
  );
}
