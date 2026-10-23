/* Ponto do meio com ar dos dois lados (substitui `N.separarPontos`): use `{a}<Ponto />{b}`
   no lugar de "a · b". */
export function Ponto() {
  return <span className="ponto">·</span>;
}
