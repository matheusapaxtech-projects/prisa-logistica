import { pastaDoDono, type DonoArquivo } from "@/lib/arquivos";
import { tipado } from "@/lib/banco";
import { estadoValidade } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { DocumentosLista, type LinhaDocumento, type TipoDocumento } from "@/components/documentos-cliente";

type Props = DonoArquivo & {
  /** Pode enviar e conferir (normalmente `pode(perfil, "editar")`). Apagar e "restrito" só aparecem
     para o administrador, decidido aqui pelo perfil logado. */
  podeEditar: boolean;
  /** Título da lista. Padrão: "Documentos" (o protótipo usa "Arquivos do motorista" etc.). */
  titulo?: string;
  /** Frase da lista vazia. Padrão: "Nenhum arquivo anexado." */
  vazio?: string;
  /** Nome do tipo pré-selecionado no envio (ex.: "CNH", "CRLV"). */
  tipoSugerido?: string;
  /** `id` da seção "Enviar documento" (alvo do botão "Anexar documento" da ficha). Padrão: um id gerado. */
  idEnvio?: string;
};

/* Documentos de uma pessoa, de um veículo ou de uma viagem (aba "Documentos" das fichas, "Arquivos da viagem"): lista com tipo, validade,
   conferência e acesso; abrir (registra a visualização e gera link de 60 s), conferir, enviar e,
   para o administrador, apagar e marcar como restrito. Linhas cujo objeto não está no Storage
   (envio interrompido) aparecem como "envio falhou", com "Enviar de novo". */
export async function Documentos({ podeEditar, titulo, vazio, tipoSugerido, idEnvio, ...dono }: Props) {
  const perfil = await getPerfil();
  const admin = pode(perfil, "admin");
  const supabase = await createClient();
  const db = tipado(supabase);
  const pasta = pastaDoDono(dono);

  let consulta = db
    .from("arquivo")
    .select(
      "id, tipo_arquivo_id, nome_original, tamanho_bytes, numero, validade, restrito, validado_em, validado_por, storage_path",
    )
    .order("created_at")
    .order("id");
  if (dono.pessoaId) consulta = consulta.eq("pessoa_id", dono.pessoaId);
  else if (dono.veiculoId) consulta = consulta.eq("veiculo_id", dono.veiculoId);
  else consulta = consulta.eq("viagem_id", dono.viagemId!);
  let tiposQ = db.from("tipo_arquivo").select("id, nome").order("nome");
  tiposQ = tiposQ.eq(dono.pessoaId ? "aplica_pessoa" : dono.veiculoId ? "aplica_veiculo" : "aplica_viagem", true);

  const [arquivos, tipos, objetos] = await Promise.all([
    consulta,
    tiposQ,
    supabase.storage.from("documentos").list(pasta, { limit: 1000 }),
  ]);
  if (arquivos.error) throw arquivos.error;
  if (tipos.error) throw tipos.error;

  // Sem conseguir listar o Storage, não acusa falha de envio em ninguém.
  const noStorage = objetos.error ? null : new Set((objetos.data ?? []).map((o) => o.name));

  // Nome de quem conferiu: `nomes_usuarios` devolve só user_id e nome para quem tem pode_ler()
  // (o RLS de perfil_usuario esconderia os outros usuários de quem não é admin).
  const conferentes = [...new Set((arquivos.data ?? []).map((a) => a.validado_por).filter((u): u is string => !!u))];
  const perfis = conferentes.length ? await db.rpc("nomes_usuarios", { p_ids: conferentes }) : null;
  if (perfis?.error) throw perfis.error;
  const nomes = new Map((perfis?.data ?? []).map((p) => [p.user_id, p.nome]));

  const nomeTipo = new Map((tipos.data ?? []).map((t) => [t.id, t.nome]));
  const linhas: LinhaDocumento[] = (arquivos.data ?? []).map((a) => {
    const e = estadoValidade(a.validade);
    return {
      id: a.id,
      tipo: nomeTipo.get(a.tipo_arquivo_id) ?? "Documento",
      nome: a.nome_original ?? a.storage_path.split("/").pop() ?? "",
      tamanho: a.tamanho_bytes,
      numero: a.numero,
      validade: a.validade,
      estado: e.cls,
      textoValidade: e.dias === null ? null : e.cls === "normal" ? "em dia" : formato.dias(e.dias),
      conferidoPor: a.validado_por ? (nomes.get(a.validado_por) ?? "usuário removido") : null,
      conferidoEm: a.validado_em ? formato.dataHora(a.validado_em).slice(0, 10) : null,
      restrito: a.restrito,
      caminho: a.storage_path,
      envioFalhou: noStorage ? !noStorage.has(a.storage_path.split("/").pop() ?? "") : false,
    };
  });
  const listaTipos: TipoDocumento[] = (tipos.data ?? []).map((t) => ({ id: t.id, nome: t.nome }));

  return (
    <DocumentosLista
      dono={dono.pessoaId ? { pessoaId: dono.pessoaId } : dono.veiculoId ? { veiculoId: dono.veiculoId } : { viagemId: dono.viagemId! }}
      linhas={linhas}
      tipos={listaTipos}
      podeEditar={podeEditar}
      admin={admin}
      nomeUsuario={perfil?.nome ?? ""}
      titulo={titulo ?? "Documentos"}
      vazio={vazio ?? "Nenhum arquivo anexado."}
      tipoSugerido={tipoSugerido}
      idEnvio={idEnvio}
    />
  );
}
