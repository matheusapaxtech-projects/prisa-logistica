import "@/styles/paginas/proprietarios.css";

/* Esqueleto da lista de clientes: mesmo título, busca e linhas da tabela pronta, com barras no
   lugar do texto. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

const COLUNAS = ["Cliente", "Documento", "Faturamento", "Exigências", "Locais"];
const CLASSES = ["col-prop", "col-doc some-tablet", "some-celular", "some-celular", "num"];

export default function CarregandoClientes() {
  return (
    <main className="prop" aria-busy="true" aria-label="Carregando os clientes">
      <div className="titulo">
        <div>
          <h1>Clientes</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={320} h={14} />
          </p>
        </div>
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={320} h={32} r={6} />
        <Barra w={90} h={14} />
      </div>
      <div className="tabela-wrap">
        <table className="tabela" aria-hidden="true">
          <thead>
            <tr>
              {COLUNAS.map((c, i) => (
                <th key={c} scope="col" className={CLASSES[i]}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="carregando">
            {Array.from({ length: 6 }, (_, n) => (
              <tr key={n}>
                <td>
                  <Barra w={200} h={14} />
                  <br />
                  <Barra w={140} />
                </td>
                <td className="some-tablet">
                  <Barra w={130} />
                </td>
                <td className="some-celular">
                  <Barra w={80} />
                </td>
                <td className="some-celular">
                  <Barra w={110} h={20} r={4} />
                </td>
                <td className="num">
                  <Barra w={24} h={14} />
                  <br />
                  <Barra w={110} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
