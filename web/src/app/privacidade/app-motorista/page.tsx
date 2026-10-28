import type { Metadata } from "next";
import "@/styles/paginas/privacidade.css";

export const metadata: Metadata = {
  title: "Política de privacidade do app do motorista",
  description: "Como o app Prisa Motorista usa a sua localização e os seus dados.",
};

/* Política de privacidade do app do motorista (exigência do Google Play para localização em segundo plano: a
   mesma página vai no link da loja e no app). Página pública: o proxy deixa /privacidade passar sem login.
   Os dados da empresa ficam em EMPRESA; o que está "a preencher" precisa ser confirmado pela Prisa antes de
   publicar o app na loja. Revisar com o jurídico antes da publicação. */

const EMPRESA = {
  nome: "Prisa Logística e Transportes",
  cnpj: "a preencher",
  endereco: "a preencher",
  contato: "a preencher (e-mail do encarregado de dados)",
};

const ATUALIZADA_EM = "26 de outubro de 2026";

export default function PoliticaAppMotorista() {
  return (
    <main className="privacidade">
      <article>
        <p className="marca">Prisa Motorista</p>
        <h1>Política de privacidade do app do motorista</h1>
        <p className="atualizada">Atualizada em {ATUALIZADA_EM}.</p>

        <p>
          Esta política explica quais dados o app <b>Prisa Motorista</b> coleta, para que eles servem, quem tem acesso e como você
          pode parar. O app é da {EMPRESA.nome} (CNPJ {EMPRESA.cnpj}, {EMPRESA.endereco}), que é a controladora dos dados,
          conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>

        <h2>Localização, inclusive com o app fechado</h2>
        <p>
          Com a sua permissão, o app coleta a <b>localização do celular o tempo todo, mesmo quando o app está fechado ou não está em
          uso</b>. A posição é enviada à Prisa a cada 1 km rodado ou a cada 10 minutos, o que vier antes. Enquanto isso acontece, o
          Android mostra um aviso fixo: <i>“Prisa: localização ativa”</i>.
        </p>
        <p>A localização é usada só para:</p>
        <ul>
          <li>mostrar no app os fretes perto de você;</li>
          <li>calcular a distância do seu caminhão até o local de coleta de cada frete;</li>
          <li>
            ajudar a operação da Prisa a escolher o caminhão mais perto da coleta, com os eixos e a carroceria que a carga pede.
          </li>
        </ul>
        <p>
          Guardamos <b>só a última posição</b> de cada motorista. A localização não é usada para publicidade, não é vendida e não é
          compartilhada com terceiros.
        </p>

        <h2>Outros dados que o app usa</h2>
        <ul>
          <li>
            <b>Celular:</b> o número que você passou para a Prisa, usado para entrar no app com o código enviado pelo WhatsApp.
          </li>
          <li>
            <b>Disponibilidade:</b> quando você toca em “Estou livre”, guardamos até quando você está livre e onde estava.
          </li>
          <li>
            <b>Interesse em fretes:</b> os fretes em que você tocou em “Tenho interesse”.
          </li>
          <li>
            <b>Cadastro:</b> os dados do seu cadastro de motorista na Prisa (nome, CNH, situação na gerenciadora de risco e o caminhão
            ligado a você), mostrados para você conferir o que falta para ser contratado.
          </li>
        </ul>

        <h2>Por que podemos tratar esses dados</h2>
        <p>
          A localização em segundo plano depende do seu <b>consentimento</b>, dado na tela do app que explica o uso e na permissão
          do Android (“Permitir o tempo todo”). Os demais dados são tratados para executar a relação de transporte entre você e a
          Prisa e para cumprir obrigações legais do transporte rodoviário de cargas.
        </p>

        <h2>Quem vê</h2>
        <p>
          Só a equipe de operação da Prisa, no sistema interno de despacho, com acesso por usuário e senha. Os dados ficam em
          servidores do Supabase (banco de dados) contratados pela Prisa. O código de entrada passa pelo serviço de mensagens que
          envia o WhatsApp.
        </p>

        <h2>Por quanto tempo</h2>
        <ul>
          <li>Localização: só a última posição, trocada a cada envio. Ela é apagada quando o seu acesso ao app é encerrado.</li>
          <li>Disponibilidade e interesses: enquanto durar a sua relação com a Prisa e pelo prazo que a lei exigir.</li>
        </ul>

        <h2>Como parar</h2>
        <ul>
          <li>Toque em <b>Sair</b> no app: o envio da localização para na hora.</li>
          <li>Nos ajustes do celular, mude a permissão de localização do app para “Durante o uso do app” ou “Não permitir”.</li>
          <li>Peça à operação da Prisa para encerrar o seu acesso ao app.</li>
        </ul>
        <p>Sem a localização você ainda pode usar o app, mas a Prisa não consegue te achar para os fretes perto.</p>

        <h2 id="excluir-conta">Como excluir a sua conta</h2>
        <p>
          No app, toque nas suas iniciais, no alto da tela, e depois em <b>Excluir conta</b>. Sem o app, peça ao encarregado de
          dados da Prisa: {EMPRESA.contato}.
        </p>
        <ul>
          <li>Apagamos na hora: o seu acesso ao app, a sua localização e o seu “estou livre”.</li>
          <li>Os seus interesses em fretes ainda abertos são retirados.</li>
          <li>
            Ficam guardados o seu cadastro, as suas viagens e os pagamentos de frete, pelo prazo que a lei fiscal e a ANTT exigem.
          </li>
        </ul>
        <p>Para voltar a usar o app, peça à operação da Prisa para liberar o seu celular de novo.</p>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir para confirmar, ver, corrigir ou apagar os seus dados, saber com quem eles foram compartilhados e retirar
          o consentimento a qualquer momento. Fale com o encarregado de dados da Prisa: {EMPRESA.contato}.
        </p>

        <h2>Mudanças nesta política</h2>
        <p>Se esta política mudar, a data no início da página muda junto, e o app avisa antes de pedir qualquer permissão nova.</p>
      </article>
    </main>
  );
}
