import { validacao } from "@/lib/validacao";

/* Placa do veículo (`N.desenhar.placa`): Mercosul com a faixa azul; padrão antigo em cinza. */
export function Placa({ placa, grande = false }: { placa: string; grande?: boolean }) {
  const p = validacao.normalizarPlaca(placa);
  const classe = `placa${validacao.mercosul(p) ? "" : " antiga"}${grande ? " grande" : ""}`;
  return (
    <span className={classe} aria-label={`Placa ${p}`}>
      <b>{p}</b>
    </span>
  );
}
