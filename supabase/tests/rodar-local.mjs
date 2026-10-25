// Roda a suíte pgTAP no Supabase LOCAL (container supabase_db_nilt, de `supabase start`).
// Cada arquivo vai como _helpers.sql + <arquivo>.test.sql, numa transação que termina em rollback.
//
//   node supabase/tests/rodar-local.mjs              todos os arquivos
//   node supabase/tests/rodar-local.mjs quadro pessoa só os que contêm esses nomes
//
// Nunca aponta para a nuvem: fala só com o container local pelo `docker exec`.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pasta = dirname(fileURLToPath(import.meta.url));
const container = "supabase_db_nilt";
const filtros = process.argv.slice(2);
const helpers = readFileSync(join(pasta, "_helpers.sql"), "utf8");

const arquivos = readdirSync(pasta)
  .filter((f) => f.endsWith(".test.sql"))
  .filter((f) => filtros.length === 0 || filtros.some((n) => f.includes(n)))
  .sort();

if (arquivos.length === 0) {
  console.error("Nenhum arquivo de teste encontrado para:", filtros.join(" "));
  process.exit(1);
}

let totalFalhas = 0;
for (const arquivo of arquivos) {
  let saida;
  try {
    saida = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      { input: helpers + readFileSync(join(pasta, arquivo), "utf8"), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (erro) {
    if (String(erro.stderr ?? "").includes("No such container")) {
      console.error(`O container ${container} não está rodando. Suba o banco local com: npx supabase start`);
      process.exit(1);
    }
    saida = `${erro.stdout ?? ""}\n${erro.stderr ?? ""}`;
  }
  const linhas = saida.split(/\r?\n/);
  const testes = linhas.filter((l) => /^(not )?ok\b/.test(l)).length;
  const falhas = linhas.filter((l) => /^not ok\b|ERROR|Looks like you failed/.test(l));
  totalFalhas += falhas.length;
  console.log(`${falhas.length ? "FALHOU" : "ok    "}  ${arquivo}  (${testes} testes)`);
  for (const l of falhas.slice(0, 10)) console.log(`        ${l}`);
}

console.log(totalFalhas ? `\n${totalFalhas} falha(s).` : `\nTudo passou (${arquivos.length} arquivos).`);
process.exit(totalFalhas ? 1 : 0);
