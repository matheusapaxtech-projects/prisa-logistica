"use server";

import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { MAX_RESULTADOS, termoBusca, type ResultadoBusca } from "@/lib/busca";
import { formato } from "@/lib/formato";

type Nome = { nome: string } | { nome: string }[] | null;
const nomeDe = (r: Nome) => (Array.isArray(r) ? r[0]?.nome : r?.nome) ?? "";

/**
 * Busca global da topbar (o `buscar()` do protótipo): veículos pela placa e pessoas pelo nome,
 * apelido, nome fantasia ou dígitos do CPF/CNPJ. Veículos primeiro; no máximo 8 no total.
 * Pessoa que é motorista abre a ficha de motorista; senão, a de proprietário.
 * O termo passa por `termoBusca` (só letras, dígitos e espaço) antes de entrar no filtro `.or()`.
 */
export async function buscar(termo: string): Promise<ResultadoAcao<ResultadoBusca[]>> {
  const t = typeof termo === "string" ? termoBusca(termo.slice(0, 80)) : null;
  if (!t) return { ok: true, dados: [] };

  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const filtros = [`nome.ilike.*${t.texto}*`, `apelido.ilike.*${t.texto}*`, `nome_fantasia.ilike.*${t.texto}*`];
    if (t.digitos.length >= 3) filtros.push(`cpf.like.*${t.digitos}*`, `cnpj.like.*${t.digitos}*`);

    const [veiculos, pessoas] = await Promise.all([
      t.placa.length >= 2
        ? db
            .from("veiculo")
            .select("id, placa, modelo, marca_veiculo(nome), tipo_veiculo(nome)")
            .ilike("placa", `%${t.placa}%`)
            .order("placa")
            .limit(MAX_RESULTADOS)
        : null,
      db.from("pessoa").select("id, nome, tipo, cpf, cnpj").or(filtros.join(",")).order("nome").limit(MAX_RESULTADOS),
    ]);
    if (veiculos?.error) throw veiculos.error;
    if (pessoas.error) throw pessoas.error;

    const idsPessoa = (pessoas.data ?? []).map((p) => p.id);
    const motoristas = new Set<string>();
    if (idsPessoa.length) {
      const { data, error } = await db.from("motorista").select("pessoa_id").in("pessoa_id", idsPessoa);
      if (error) throw error;
      (data ?? []).forEach((m) => motoristas.add(m.pessoa_id));
    }

    const res: ResultadoBusca[] = [];
    for (const v of veiculos?.data ?? []) {
      res.push({
        href: `/veiculos/${v.id}`,
        placa: v.placa,
        nome: [nomeDe(v.marca_veiculo as Nome), v.modelo].filter(Boolean).join(" "),
        tipo: nomeDe(v.tipo_veiculo as Nome).toLowerCase().replace(/ - \d eixos/, ""),
      });
    }
    for (const p of pessoas.data ?? []) {
      const motorista = motoristas.has(p.id);
      res.push({
        href: motorista ? `/motoristas/${p.id}` : `/proprietarios/${p.id}`,
        cod: formato.doc(p),
        nome: p.nome,
        tipo: motorista ? "motorista" : "proprietário",
      });
    }
    return res.slice(0, MAX_RESULTADOS);
  });
}
