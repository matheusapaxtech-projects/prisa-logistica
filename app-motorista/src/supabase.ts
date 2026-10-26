/* Cliente do Supabase do app do motorista. Só a chave publicável (nunca a secreta): o banco só deixa o
   motorista chamar as funções do app (fretes_para_mim, registrar_checkin…), sempre pelos próprios dados. */
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "", process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Renova o login só com o app aberto (recomendação do Supabase para React Native).
AppState.addEventListener("change", (estado) => {
  if (estado === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Entrada de teste (motorista fictício do banco local). Só aparece com EXPO_PUBLIC_LOGIN_TESTE=1. */
export const LOGIN_TESTE = process.env.EXPO_PUBLIC_LOGIN_TESTE === "1";

export type Frete = {
  oferta_id: string;
  pedido_numero: number;
  produto: string;
  coleta_cidade: string;
  coleta_uf: string;
  descarga_cidade: string;
  descarga_uf: string;
  saldo_t: number;
  coleta_prevista: string | null;
  entrega_prevista: string | null;
  frete_motorista_por_t: number;
  km_ate_embarque: number;
  observacao: string | null;
  tenho_interesse: boolean;
};

export type Pendencia = { codigo: string; nivel: string; mensagem: string };

export type Cadastro = {
  nome: string;
  apelido: string | null;
  situacao_cadastro: string;
  conjunto: { cavalo: string; eixos: number; carrocerias: string[] | null } | null;
  checkin: { cidade: string; livre_ate: string; em: string } | null;
};

/** Mensagem do erro do banco para a tela (as funções do app já escrevem em português). */
export function mensagem(e: unknown): string {
  const m = (e as { message?: string })?.message ?? "";
  if (/network|fetch/i.test(m)) return "Sem conexão. Confira a internet e tente de novo.";
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Algo deu errado. Tente de novo.";
}
