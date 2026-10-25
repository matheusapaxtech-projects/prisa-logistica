import "@/styles/paginas/proprietarios.css";

/* Esqueleto de "Novo cliente": título, seção Tipo (dois cartões) e o documento. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoNovoCliente() {
  return (
    <main className="prop" aria-busy="true" aria-label="Carregando o cadastro de cliente">
      <div className="titulo carregando" aria-hidden="true">
        <div>
          <Barra w={240} h={20} />
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
          <Barra w={100} h={16} />
          <br />
          <Barra w="90%" />
        </div>
        <Barra w="60%" h={38} r={6} />
      </section>
    </main>
  );
}
