import { exigirPerfil } from "@/lib/permissoes";

// Página temporária da Task 2 (a Task 6 substitui): confere fonte e cores do protótipo.
// exigirPerfil() fica aqui até a Task 5 levá-lo para (app)/layout.tsx.
export default async function Home() {
  await exigirPerfil();
  return (
    <main style={{ padding: 24, display: "flex", gap: 16, alignItems: "center" }}>
      <span className="sinal sinal-normal">Normal</span>
      <span className="placa" aria-label="Placa ABC1D23">
        <b>ABC1D23</b>
      </span>
    </main>
  );
}
