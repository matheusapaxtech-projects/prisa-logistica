// Página temporária da Task 2 (a Task 6 substitui): confere fonte e cores do protótipo.
export default function Home() {
  return (
    <main style={{ padding: 24, display: "flex", gap: 16, alignItems: "center" }}>
      <span className="sinal sinal-normal">Normal</span>
      <span className="placa" aria-label="Placa ABC1D23">
        <b>ABC1D23</b>
      </span>
    </main>
  );
}
