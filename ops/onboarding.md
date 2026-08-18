# Onboarding de um salão

A estrutura já está pronta; o que falta é o conteúdo. Este ficheiro é a ordem em
que os dados entram e a lista do que pedir à dona — nessa ordem porque cada
ecrã depende do anterior.

## Ordem de registo

| # | Onde | Por que antes do seguinte |
| --- | --- | --- |
| 1 | `/comecar` | cria a primeira conta; sem ela ninguém entra no `/admin` |
| 2 | `/admin/unidades` | tudo pendura em unidade: equipa, agenda, caixa |
| 3 | `/admin/servicos` | o preço e a duração vêm daqui para a agenda |
| 4 | `/admin/equipe` | a ficha marca os serviços que a pessoa executa |
| 5 | escala, dentro da ficha | sem escala a profissional não tem coluna na agenda |

Dá para voltar e ajustar qualquer um depois. O que não dá é saltar o 2 e o 5: sem
unidade não existe agenda, e sem escala a agenda abre vazia mesmo com equipa
registada.

## Quem instala não é quem é dona

A conta do `/comecar` é de quem instalou o sistema — normalmente não a dona do
salão. É de propósito: quem monta o ambiente precisa de entrar antes de a dona
existir, e o código de instalação desaparece assim que a primeira conta nasce.

A conta da dona vem depois, em `/admin/equipe`, com o acesso **Dona** marcado —
o que exige estar em `TELEFONES_SUPORTE`, porque conceder esse degrau é do
suporte. Ela vê a rede inteira e mexe no cadastro, tal como a primeira conta.
As duas convivem sem problema, e o sistema recusa tirar o acesso da última —
inclusive o seu próprio, que só sai depois de outra pessoa já ser dona.

## O que pedir à dona

### Ela (conta de dona)

- nome completo
- telemóvel — é o login dela
- e-mail pessoal — o dela, não o da loja: é para lá que vai o código quando ela
  se esquecer da palavra-passe
- palavra-passe, ou uma provisória para ela trocar depois

### Cada unidade

- nome como as clientes chamam
- morada completa com freguesia, concelho, distrito e código postal
- telefone e e-mail da loja
- horário de funcionamento por dia da semana, com o intervalo de almoço se a
  loja fecha
- feriados e datas em que já sabe que não abre
- uma foto da sala, com a luz acesa

### Cada serviço

- nome e categoria (corte, coloração, manicure…)
- preço
- quanto tempo leva do começo ao fim, contando a espera da química
- pode ser marcado pelo site ou só pela receção
- exige sinal? avaliação presencial antes? ficha de anamnese?
- se ocupa cabine, lavatório ou equipamento — e quantos de cada a loja tem

### Cada profissional

- nome, telemóvel e e-mail — o e-mail não é enfeite: é por ele que a pessoa
  recupera a palavra-passe se se esquecer
- em quais lojas atende
- quais serviços faz
- escala da semana: dia, hora de entrada e de saída, e em qual loja
- se aparece para a cliente escolher no agendamento online
- acesso: **dona** (a rede inteira e o cadastro), **gerente** (toca a operação
  da loja) ou **profissional** (só a agenda dela). Dona é o único que a própria
  dona não consegue conceder — esse pedido vem para o suporte. Ver
  [README.md](README.md#papéis)

## O que não precisa perguntar

Já vem preenchido com o que funciona na maioria dos salões, e só mexemos se ela
reclamar: antecedência mínima de 2 h para marcar pelo site, agenda aberta até 60
dias à frente, horários de 15 em 15 minutos, cancelamento até 24 h antes.

## Antes de abrir para as clientes

- entrar com o login de cada profissional e conferir que a agenda dela abre com
  os dias certos
- marcar um agendamento de teste pelo site e fechar a comanda no caixa
- apagar esse agendamento de teste
- trocar as fotos ilustrativas pelas fotos reais do salão
