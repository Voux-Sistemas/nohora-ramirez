# Onboarding de um salão

A estrutura já está pronta; o que falta é o conteúdo. Este arquivo é a ordem em
que os dados entram e a lista do que pedir para a dona — nessa ordem porque cada
tela depende da anterior.

## Ordem de cadastro

| # | Onde | Por que antes do seguinte |
| --- | --- | --- |
| 1 | `/comecar` | cria a dona; sem ela ninguém entra no `/admin` |
| 2 | `/admin/unidades` | tudo pendura em unidade: equipe, agenda, caixa |
| 3 | `/admin/recursos` | o serviço marca o tipo de recurso que exige |
| 4 | `/admin/servicos` | o preço e a duração vêm daqui para a agenda |
| 5 | `/admin/equipe` | a ficha marca os serviços que a pessoa executa |
| 6 | escala, dentro da ficha | sem escala a profissional não tem coluna na agenda |
| 7 | `/admin/comissoes` | precisa da equipe e do catálogo já cadastrados |

Dá para voltar e ajustar qualquer um depois. O que não dá é pular o 2 e o 6: sem
unidade não existe agenda, e sem escala a agenda abre vazia mesmo com equipe
cadastrada.

## O que pedir para a dona

### Ela (conta de dona)

- nome completo
- celular com DDD — é o login dela
- senha, ou uma provisória para ela trocar depois

### Cada unidade

- nome como as clientes chamam
- endereço completo com bairro, cidade, UF e CEP
- telefone e e-mail da loja
- horário de funcionamento por dia da semana, com o intervalo de almoço se a
  loja fecha
- feriados e datas em que já sabe que não abre
- uma foto da sala, com a luz acesa

### Cada serviço

- nome e categoria (corte, coloração, manicure…)
- preço
- quanto tempo leva — e, quando o produto age sozinho, quanto desse tempo a
  profissional fica livre para atender outra cliente. É o que permite encaixar
  duas clientes no mesmo horário sem atropelar ninguém
- pode ser marcado pelo site ou só pela recepção
- exige sinal? avaliação presencial antes? ficha de anamnese?
- se ocupa cabine, lavatório ou equipamento — e quantos de cada a loja tem

### Cada profissional

- nome, celular e e-mail
- em quais lojas atende
- quais serviços faz
- escala da semana: dia, hora de entrada e de saída, e em qual loja
- se aparece para a cliente escolher no agendamento online
- acesso: **gerente** (toca a operação da loja) ou **profissional** (só a agenda
  dela). Ver [README.md](README.md#papéis)

### Comissão

- o percentual padrão da casa
- as exceções: por pessoa, por serviço, ou os dois juntos

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
