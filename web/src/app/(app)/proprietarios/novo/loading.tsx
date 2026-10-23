import "@/styles/paginas/proprietarios.css";

/* Esqueleto de "Novo proprietário": título, seção Tipo (dois cartões) e a prévia das etapas. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoNovoProprietario() {
  return (
    <main className="prop" aria-busy="true" aria-label="Carregando o cadastro de proprietário">
      <div className="titulo carregando" aria-hidden="true">
        <div>
          <Barra w={300} h={20} />
          <br />
          <Barra w={520} h={14} r={4} />
        </div>
      </div>
      <section className="secao carregando" aria-hidden="true">
        <div className="secao-rotulo">
          <Barra w={60} h={16} />
          <br />
          <Barra w="90%" />
        </div>
        <div className="tipos">
          <Barra w="100%" h={96} r={8} />
          <Barra w="100%" h={96} r={8} />
        </div>
      </section>
      <section className="secao carregando" aria-hidden="true">
        <div className="secao-rotulo">
          <Barra w={120} h={16} />
          <br />
          <Barra w="90%" />
        </div>
        <Barra w="100%" h={250} r={8} />
      </section>
    </main>
  );
}
