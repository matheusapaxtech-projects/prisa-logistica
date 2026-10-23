import { Barra } from "./barra";
import "@/styles/paginas/conjuntos.css";

/* Esqueleto da lista: título, abas, ferramentas e linhas da tabela com o engate (≈ 64 px) e a barra de capacidade. */
export default function CarregandoConjuntos() {
  return (
    <main aria-busy="true" aria-label="Carregando os conjuntos">
      <div className="titulo">
        <div>
          <h1>Conjuntos</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={260} h={14} />
          </p>
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12, display: "flex", gap: 24 }}>
        <Barra w={80} h={14} />
        <Barra w={90} h={14} />
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={300} h={32} r={6} />
        <Barra w={220} h={32} r={6} />
      </div>
      <div className="tabela-wrap">
        <table className="tabela tabela-fixa" aria-hidden="true">
          <thead>
            <tr>
              <th className="col-engate">Conjunto em ordem de engate</th>
              <th className="some-celular">Motorista</th>
              <th className="num some-celular">Eixos</th>
              <th className="col-cap">Capacidade de carga</th>
            </tr>
          </thead>
          <tbody className="carregando">
            {[0, 1, 2, 3].map((n) => (
              <tr key={n}>
                <td className="col-engate">
                  <Barra w="90%" h={58} r={6} />
                </td>
                <td className="some-celular">
                  <Barra w={150} h={14} />
                  <br />
                  <Barra w={110} />
                </td>
                <td className="num some-celular">
                  <Barra w={20} h={14} />
                </td>
                <td className="col-cap">
                  <Barra w="100%" h={8} r={4} />
                  <br />
                  <Barra w="70%" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
