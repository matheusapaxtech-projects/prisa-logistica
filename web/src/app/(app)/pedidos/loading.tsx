import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";

/* Esqueleto da lista de pedidos: mesmo título, abas, busca e linhas da tabela, com barras no lugar
   do texto. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

const COLUNAS = ["Nº", "Tomador", "Origem → destino", "Produto", "Peso total", "Saldo", "Coleta prevista"];
const CLASSES = ["col-num", "", "some-celular", "some-tablet", "num", "num", "num some-celular"];

export default function CarregandoPedidos() {
  return (
    <main className="prop ped" aria-busy="true" aria-label="Carregando os pedidos">
      <div className="titulo">
        <div>
          <h1>Pedidos</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={260} h={14} />
          </p>
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12 }}>
        {[90, 80, 90].map((w, i) => (
          <Barra key={i} w={w} h={14} />
        ))}
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
                <th key={c} scope="col" className={CLASSES[i] || undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="carregando">
            {Array.from({ length: 6 }, (_, n) => (
              <tr key={n}>
                <td>
                  <Barra w={40} h={14} />
                </td>
                <td>
                  <Barra w={160} h={14} />
                </td>
                <td className="some-celular">
                  <Barra w={200} />
                </td>
                <td className="some-tablet">
                  <Barra w={110} />
                </td>
                <td className="num">
                  <Barra w={80} />
                </td>
                <td className="num">
                  <Barra w={80} />
                </td>
                <td className="num some-celular">
                  <Barra w={80} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
