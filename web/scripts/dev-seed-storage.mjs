#!/usr/bin/env node
/* =============================================================================================
   SÓ DESENVOLVIMENTO. DADOS FICTÍCIOS. LIMPAR ANTES DA PRODUÇÃO.
   =============================================================================================
   Coloca no bucket privado "documentos" um PDF mínimo ("Documento fictício de desenvolvimento")
   para cada linha de `arquivo` da seed supabase/seed/dev_dados_ficticios.sql, que não cria objetos
   no Storage (sem eles, as fichas mostram "envio falhou").

   Uso (dentro de web/):
     node scripts/dev-seed-storage.mjs           envia os objetos que faltam
     node scripts/dev-seed-storage.mjs --limpar  remove esses objetos e os dos documentos que os testes
                                                 E2E anexaram (rode antes de supabase/seed/limpar_dados_ficticios.sql)

   - Lê NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY de web/.env.local e
     E2E_EMAIL/E2E_SENHA (o administrador de teste) de web/.env.test.local.
   - Entra como esse administrador com a chave publicável (nunca a service role): vale o RLS.
   - O envio só toca nos ids do bloco `arquivo` da seed (00000000-0000-4000-8000-000000000401 a ...454,
     ver o cabeçalho do arquivo da seed). Envio com upsert: false; "já existe" conta como ok.
   - --limpar remove também os objetos de qualquer outra linha de `arquivo` ligada ao que a limpeza
     SQL apaga: pessoas e veículos da seed (blocos 1xx e 2xx) e os criados pelos testes E2E (pessoa
     com nome "E2E …", veículo com modelo "E2E Teste"). Depois que a linha some, o objeto fica
     invisível (a leitura do Storage exige a linha): por isso este passo vem antes do SQL.
   - A remoção é pela API do Storage (DELETE em storage.objects por SQL é bloqueado).
   - Nunca imprime a senha nem tokens.
   ============================================================================================= */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const arq of [".env.local", ".env.test.local"]) {
  try {
    process.loadEnvFile(path.join(WEB, arq));
  } catch {
    // ausente: a checagem abaixo explica o que falta
  }
}

const { NEXT_PUBLIC_SUPABASE_URL: URL_SUPABASE, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE, E2E_EMAIL, E2E_SENHA } =
  process.env;
const faltando = Object.entries({ NEXT_PUBLIC_SUPABASE_URL: URL_SUPABASE, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE, E2E_EMAIL, E2E_SENHA })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (faltando.length) {
  console.error(`Faltam variáveis em web/.env.local ou web/.env.test.local: ${faltando.join(", ")}`);
  process.exit(1);
}

// Bloco `arquivo` da seed: aNN = 400 + NN (401-416, 421, 431-436, 451-454).
const numeros = [
  ...Array.from({ length: 16 }, (_, i) => 401 + i),
  421,
  ...Array.from({ length: 6 }, (_, i) => 431 + i),
  ...Array.from({ length: 4 }, (_, i) => 451 + i),
];
const IDS = numeros.map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);

/** PDF 1.4 válido de uma página com o texto, montado em memória (xref com offsets corretos). */
function pdfFicticio(titulo) {
  const texto = `Documento ficticio de desenvolvimento - ${titulo}`.replace(/[()\\]/g, "").replace(/[^\x20-\x7e]/g, "?");
  const conteudo = `BT /F1 14 Tf 56 760 Td (Documento fict\\355cio de desenvolvimento) Tj 0 -22 Td /F1 10 Tf (${texto.slice(0, 90)}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`,
  ];
  let corpo = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(corpo, "latin1"));
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corpo, "latin1");
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  corpo += offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, "latin1");
}

const supabase = createClient(URL_SUPABASE, CHAVE, { auth: { persistSession: false } });
const { error: erroLogin } = await supabase.auth.signInWithPassword({ email: E2E_EMAIL, password: E2E_SENHA });
if (erroLogin) {
  console.error(`Não foi possível entrar como o administrador de teste: ${erroLogin.message}`);
  process.exit(1);
}

const { data: linhas, error } = await supabase
  .from("arquivo")
  .select("id, storage_path, nome_original")
  .in("id", IDS)
  .order("id");
if (error) {
  console.error(`Falha ao ler os arquivos da seed: ${error.message}`);
  process.exit(1);
}
console.log(`${linhas.length} linhas de arquivo da seed encontradas (de ${IDS.length} ids do bloco).`);

const bucket = supabase.storage.from("documentos");
let ok = 0;
let falhas = 0;

/** Ids por requisição em `.in()`: a lista vai na URL, e centenas de uuids estourariam o limite dela. */
const LOTE_IN = 100;

/** `select id, storage_path from arquivo where <coluna> in (ids)`, em lotes de LOTE_IN ids. */
async function arquivosPor(coluna, ids) {
  const linhas = [];
  for (let i = 0; i < ids.length; i += LOTE_IN) {
    const { data, error } = await supabase.from("arquivo").select("id, storage_path").in(coluna, ids.slice(i, i + LOTE_IN));
    if (error) throw new Error(error.message);
    linhas.push(...data);
  }
  return linhas;
}

/** Linhas de `arquivo` dos alvos da limpeza SQL que não são do bloco da seed (ex.: anexadas pelos E2E). */
async function arquivosDosTestes() {
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const pessoasSeed = Array.from({ length: 12 }, (_, i) => id(101 + i));
  const veiculosSeed = Array.from({ length: 21 }, (_, i) => id(201 + i));
  const [pE2e, vE2e] = await Promise.all([
    supabase.from("pessoa").select("id").like("nome", "E2E %"),
    supabase.from("veiculo").select("id").eq("modelo", "E2E Teste"),
  ]);
  for (const r of [pE2e, vE2e]) if (r.error) throw new Error(r.error.message);
  const pessoas = [...pessoasSeed, ...pE2e.data.map((r) => r.id)];
  const veiculos = [...veiculosSeed, ...vE2e.data.map((r) => r.id)];
  const porPessoa = await arquivosPor("pessoa_id", pessoas);
  const porVeiculo = await arquivosPor("veiculo_id", veiculos);
  return [...porPessoa, ...porVeiculo].filter((l) => !IDS.includes(l.id));
}

if (process.argv.includes("--limpar")) {
  let extras;
  try {
    extras = await arquivosDosTestes();
  } catch (e) {
    console.error(`Falha ao ler os arquivos dos testes: ${e.message}`);
    process.exit(1);
  }
  console.log(`${extras.length} outras linhas de arquivo (anexadas pelos testes) entram na remoção.`);
  const caminhos = [...new Set([...linhas, ...extras].map((l) => l.storage_path))];
  for (let i = 0; i < caminhos.length; i += 50) {
    const { data, error: e } = await bucket.remove(caminhos.slice(i, i + 50));
    if (e) {
      falhas += caminhos.slice(i, i + 50).length;
      console.error(`Falha ao remover: ${e.message}`);
    } else ok += data.length;
  }
  console.log(`Removidos: ${ok}. Falhas: ${falhas}.`);
} else {
  for (const l of linhas) {
    const { error: e } = await bucket.upload(l.storage_path, pdfFicticio(l.nome_original ?? l.id), {
      upsert: false,
      contentType: "application/pdf",
    });
    if (!e || /exists|duplicate/i.test(e.message)) ok++;
    else {
      falhas++;
      console.error(`Falha em ${l.storage_path}: ${e.message}`);
    }
  }
  console.log(`Objetos no lugar: ${ok}. Falhas: ${falhas}.`);
}

await supabase.auth.signOut({ scope: "local" });
process.exit(falhas ? 1 : 0);
