# Google Play: localização em segundo plano do app Prisa Motorista

O app pede `ACCESS_BACKGROUND_LOCATION` (localização o tempo todo) e usa um serviço em primeiro plano do tipo
`location` (`FOREGROUND_SERVICE_LOCATION`, Android 14+). O Google Play exige, para aprovar:

| Exigência | Onde está |
|---|---|
| Aviso em destaque no app, antes de pedir a permissão | Tela "A Prisa usa sua localização o tempo todo" (`app-motorista/src/telas/PermitirLocalizacao.tsx`) |
| Política de privacidade no app e na ficha da loja | `https://nilt-lemon.vercel.app/privacidade/app-motorista` (página pública do NILT, `web/src/app/privacidade/app-motorista/page.tsx`); link no app na tela de entrada e no aviso de localização |
| Formulário de declaração de permissões | Texto abaixo, para colar no Play Console |
| Vídeo de demonstração | Roteiro abaixo; gravação do emulador em `docs/app-motorista/video-localizacao.mp4` |

Regras: [localização em segundo plano](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en),
[aviso em destaque](https://support.google.com/googleplay/android-developer/answer/11150561),
[serviço em primeiro plano](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en).

**Antes de enviar:** preencher CNPJ, endereço e contato do encarregado de dados na política (constante `EMPRESA`
da página) e pedir a revisão do jurídico.

## Formulário de declaração (Play Console → Conteúdo do app → Permissões confidenciais)

**Qual recurso do app usa a localização em segundo plano?**

> O Prisa Motorista é o app dos motoristas e agregados da transportadora Prisa Logística e Transportes. Com o app
> aberto ou fechado, ele envia a posição do caminhão para a Prisa a cada 1 km rodado ou 10 minutos. A Prisa usa essa
> posição para mostrar ao motorista os fretes perto dele e para escolher, no despacho, o caminhão mais perto do
> local de coleta, com os eixos e a carroceria que a carga pede. O motorista passa a maior parte do tempo dirigindo,
> com o app fechado; sem a posição em segundo plano a Prisa só saberia onde ele está quando ele abrisse o app, e a
> oferta de frete chegaria tarde ou para o caminhão errado.

**Por que o recurso precisa da localização em segundo plano e não só com o app aberto?**

> A escolha do caminhão para um frete acontece no sistema da Prisa, a qualquer hora, enquanto o motorista está na
> estrada com o celular no painel. A posição de quando o app foi aberto pela última vez fica velha em poucas horas
> e leva a ofertas erradas. A posição só vale para o despacho por 2 horas.

**Como o usuário fica sabendo e controla?**

> Antes de pedir a permissão, o app mostra uma tela própria explicando que a localização é coletada mesmo com o app
> fechado, para quê, quem vê e como parar, com as opções "Permitir localização" e "Agora não". Enquanto a coleta
> acontece, o Android mostra o aviso fixo "Prisa: localização ativa". O motorista para a coleta tocando em "Sair" ou
> mudando a permissão nos ajustes. Guardamos só a última posição; ela não é usada para publicidade nem
> compartilhada com terceiros.

**Serviço em primeiro plano (tipo location):**

> O serviço em primeiro plano mantém o envio da posição do caminhão enquanto o motorista dirige com o app fechado,
> com a notificação fixa "Prisa: localização ativa". Ele para quando o motorista sai do app.

## Roteiro do vídeo (até 30 segundos, sem som)

1. Abrir o app e entrar (tela de entrada com o link da política).
2. Aparece o aviso em destaque "A Prisa usa sua localização o tempo todo": mostrar os três itens.
3. Tocar em "Permitir localização" e escolher "Durante o uso do app" no Android.
4. O Android abre os ajustes: escolher "Permitir o tempo todo" e voltar.
5. Tela principal com os fretes perto e a distância até a coleta.
6. Sair do app (botão início) e abrir a barra de notificações: aviso "Prisa: localização ativa".

Gravar no emulador com `adb shell screenrecord /sdcard/video.mp4` e baixar com `adb pull`.
