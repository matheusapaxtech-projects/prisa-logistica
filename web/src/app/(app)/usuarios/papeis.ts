import type { Papel } from "@/lib/papeis";

/** Papéis e o que cada um pode (mesmos textos de `PAPEIS` em prototipo/usuarios.html). */
export const PAPEIS: readonly { id: Papel; rot: string; o_que: string }[] = [
  { id: "admin", rot: "Administrador", o_que: "Tudo, inclusive usuários, auditoria, apagar registros e ver documentos restritos." },
  { id: "operacao", rot: "Operação", o_que: "Cadastra e edita motoristas, proprietários, veículos, conjuntos e documentos." },
  { id: "financeiro", rot: "Financeiro", o_que: "Lê tudo e edita contas bancárias e chaves Pix." },
  { id: "leitura", rot: "Leitura", o_que: "Só consulta. Não altera nada." },
];

export const rotPapel = (p: Papel | null | undefined): string | undefined => PAPEIS.find((x) => x.id === p)?.rot;

/** Linha de `listar_usuarios()`. Os tipos gerados não marcam `| null` em nome, papel e último acesso
   (a função faz left join com perfil_usuario e last_sign_in_at), então o tipo certo é este. */
export type UsuarioLinha = {
  user_id: string;
  email: string;
  nome: string | null;
  papel: Papel | null;
  ativo: boolean;
  ultimo_acesso: string | null;
};

/** O que o Client Component recebe: a linha + o texto do último acesso, já calculado no servidor
   (o "há 5 min" depende da hora; no cliente a hidratação poderia divergir). */
export type UsuarioTela = UsuarioLinha & { acesso: string };

export type Situacao = "sem_acesso" | "ativo" | "desativado";

export const situacao = (u: Pick<UsuarioLinha, "papel" | "ativo">): Situacao => (!u.papel ? "sem_acesso" : u.ativo ? "ativo" : "desativado");

export const nomeDe = (u: Pick<UsuarioLinha, "nome" | "email">): string => u.nome || u.email.split("@")[0];

export const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "ativo", rotulo: "Ativos" },
  { id: "desativado", rotulo: "Desativados" },
  { id: "sem_acesso", rotulo: "Sem acesso" },
] as const;

export type FiltroId = (typeof FILTROS)[number]["id"];

export const ehFiltro = (v: string | undefined): v is FiltroId => FILTROS.some((f) => f.id === v);
