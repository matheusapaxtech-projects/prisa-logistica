"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

/* Depois de "Criar veículo": avisa uma vez e tira `?criado=1` da URL (`?criado=1` do protótipo). Se o
   contrato escolhido no cadastro não chegou ao armazenamento, diz isso também. */
export function AvisoCriado({ placa, envioFalhou }: { placa: string; envioFalhou: boolean }) {
  const router = useRouter();
  const caminho = usePathname();
  useEffect(() => {
    const t = setTimeout(() => {
      toast(`Veículo ${placa} criado. Complete a ficha com calma.`);
      if (envioFalhou) toast("O contrato não chegou ao armazenamento. Anexe de novo na aba Documentos.", "alert-circle");
      router.replace(caminho, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [placa, envioFalhou, caminho, router]);
  return null;
}
