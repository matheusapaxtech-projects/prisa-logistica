import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";
import "@/styles/paginas/viagens.css";

/* Esqueleto da ficha da viagem, no desenho da ficha: cabeçalho (migalha, linha e sinais), próximo passo e
   as duas colunas de cartões (rota com a carga, motorista e conjunto; situação e aptidão). */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

function CartaoLinhas({ titulo, linhas }: { titulo: number; linhas: (number | string)[] }) {
  return (
    <div className="bloco carregando">
      <div className="bloco-cab">
        <Barra w={titulo} h={16} />
      </div>
      <div className="bloco-corpo" style={{ display: "grid", gap: 14 }}>
        {linhas.map((w, i) => (
          <Barra key={i} w={w} h={14} />
        ))}
      </div>
    </div>
  );
}

export default function CarregandoFichaViagem() {
  return (
    <main className="prop ped via" aria-busy="true" aria-label="Carregando a viagem">
      <div className="cab-ficha carregando" aria-hidden="true">
        <div className="ident">
          <Barra w={220} h={20} />
          <Barra w={320} h={14} />
          <div className="sinais">
            <Barra w={90} h={22} r={999} />
            <Barra w={130} h={22} r={999} />
          </div>
        </div>
      </div>
      <div className="proximo-passo carregando" aria-hidden="true">
        <div className="texto">
          <Barra w={90} />
          <Barra w={220} h={20} />
        </div>
        <Barra w={170} h={36} r={999} />
      </div>
      <div className="grade ficha-ped ficha-via" aria-hidden="true">
        <div className="coluna">
          <div className="bloco rota-ped carregando">
            <div className="rota">
              <div className="ponta origem">
                <Barra w="70%" h={30} />
                <Barra w="50%" h={12} />
              </div>
              <div className="estrada">
                <Barra w="100%" h={10} r={999} />
              </div>
              <div className="ponta destino">
                <Barra w="70%" h={30} />
                <Barra w="50%" h={12} />
              </div>
            </div>
            <div className="carga">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Barra w={70} />
                  <Barra w={110} h={18} />
                </div>
              ))}
            </div>
          </div>
          <CartaoLinhas titulo={160} linhas={["60%", "45%"]} />
        </div>
        <div className="coluna">
          <div className="bloco carregando">
            <div className="bloco-cab">
              <Barra w={80} h={16} />
            </div>
            <div className="bloco-corpo" style={{ display: "grid", gap: 10 }}>
              <Barra w={160} h={30} />
              <Barra w={190} />
              <Barra w="100%" h={14} />
            </div>
          </div>
          <CartaoLinhas titulo={90} linhas={["100%", "80%", "90%"]} />
        </div>
      </div>
    </main>
  );
}
