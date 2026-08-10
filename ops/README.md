# Operação da produção

O que é preciso saber para instalar, entrar e não perder dado. Cada seção é uma
coisa que já deu (ou daria) trabalho descobrir na hora errada.

| Assunto | Onde |
| --- | --- |
| Backup diário e prova do restore | [backup/README.md](backup/README.md) |
| Dados a pedir para a dona, na ordem | [onboarding.md](onboarding.md) |
| Primeira conta do sistema | aqui embaixo |

## A primeira conta

Banco novo não tem ninguém, e o sistema não deixa entrar quem não existe:
`/admin` exige sessão de equipe, e a senha da equipe só se define **dentro** de
`/admin`. Instalado e inacessível é um estado real — a produção subiu nele.

A saída é `/comecar`, que cria a conta da dona (papel `owner`, escopo de rede) e
já entra com ela. A tela existe sob duas condições ao mesmo tempo:

1. **nenhuma conta de equipe no banco.** A primeira conta criada fecha a porta,
   e ela não reabre. Não depende de ninguém lembrar de desligar nada;
2. **`CODIGO_INSTALACAO` configurada** no serviço `web`. Sem a variável, a porta
   está fechada — o padrão é fechado, igual ao de `AMBIENTE`.

Fora dessas condições `/comecar` redireciona para `/entrar` sem dizer por quê:
quem chega ali não descobre se o sistema já tem dono nem se o código existe.

A condição (1) sozinha não bastaria. Entre o deploy e o primeiro login o
endereço já é público, e quem chegasse primeiro viraria dono do salão.

**Para instalar um salão novo:**

```sh
railway variable set CODIGO_INSTALACAO=<código> --service web
```

Abra `/comecar`, preencha nome, celular e senha da dona, e informe o código.
Depois disso a variável pode ficar onde está — a porta já está fechada pela
conta que existe. Trocar o código não reabre nada.

**Se a conta for criada errada** (nome ou telefone trocado), não há tela para
desfazer: apague a linha e refaça. O container não tem `psql` — tem o Node e o
driver da aplicação, que dá no mesmo:

```sh
railway ssh --service web
# lá dentro, com DATABASE_URL já no ambiente. O telefone vai como argumento,
# não colado dentro do SQL.
node -e 'const s=require("postgres")(process.env.DATABASE_URL);s`delete from users where phone = ${process.argv[1]}`.then(r=>console.log(r.count)).finally(()=>s.end())' "+5511999998888"
```

Apagar a pessoa leva junto papéis e sessões (`on delete cascade`), e `/comecar`
volta a abrir sozinha.

## Papéis

São quatro degraus, e quem decide o que é
`apps/web/src/server/auth/permissoes.ts`. Todo porteiro do sistema sai de lá.

| Papel | De onde vem | Enxerga | Decide |
| --- | --- | --- | --- |
| Suporte | `TELEFONES_SUPORTE` (variável) | a rede | tudo, mais o que define a instalação |
| Dona | `owner` (sem unidade) | a rede | tudo: unidades, catálogo, comissões, equipe |
| Gerente | `unit_manager`, uma linha por unidade | as lojas dela | operação e equipe dessas lojas |
| Profissional | `professional` | a própria agenda | o próprio atendimento |

Três coisas que não são óbvias e mordem se esquecidas:

- **Suporte não mora no banco, e isso é o ponto.** Somos nós, não o salão.
  Qualquer degrau guardado em `user_roles` poderia ser dado por quem já tem o
  cadastro na mão; este só se concede no painel do Railway. A variável **eleva,
  não autentica**: quem está na lista continua precisando de um papel de equipe
  para entrar. Na prática a conta de instalação é `owner` **e** está na lista.

- **O alcance da profissional não vem de `user_roles`.** A linha dela é gravada
  sem unidade; onde ela atende é `staff_units`, a mesma tabela que monta as
  colunas da agenda. Ler de outro lugar abriria a porta de uma loja em que ela
  não trabalha.
- **O padrão é fechado.** `receptionist` e `finance` existem no enum do banco
  desde o começo e **não abrem porta nenhuma** — quem tiver só um desses papéis
  cai no login. Não é esquecimento: reconhecer por engano daria acesso de gestão
  a quem ninguém decidiu dar. Quando esses papéis existirem de verdade, o caminho
  é entrar na tabela `DEGRAUS` de propósito.

Quem nomeia gerente é a dona, em `/admin/equipe`. O formulário grava uma linha de
`unit_manager` por unidade marcada.

### O que só o suporte faz

Quatro coisas, escolhidas pelo mesmo critério: são decisões que o salão pede uma
vez e que ninguém desfaz por dentro depois.

| O quê | Onde | Por que não é da dona |
| --- | --- | --- |
| Abrir uma unidade | `/admin/unidades/nova` | mexe em cobrança e tudo pendura em unidade |
| Mudar o slug de uma unidade | ficha da unidade | é o link já impresso em cartão e no Instagram |
| Criar um tipo de recurso | `/admin/recursos` | muda as três lojas e não existe tela de apagar |
| Dar (ou tirar) acesso de **dona** | `/admin/equipe` | entrega o cadastro da rede e não tem volta fácil |

O quarto vale nas duas direções de propósito: sem isso, a dona que abrisse a
ficha da sócia e salvasse qualquer outro campo a rebaixaria sem querer, porque a
tela dela não mostra o botão "Dona" para ficar marcado.

O que **continua sendo da dona**, e é a maior parte: catálogo e preço, equipe e
escala, comissão, horário de funcionamento, feriado, foto, endereço, telefone e
as regras de agendamento de cada loja. Adicionar mais uma cabine do tipo que já
existe também é dela — o que passa por nós é inventar um tipo novo.

As telas de rede (`/admin/unidades`, `/admin/servicos`, `/admin/comissoes`) somem
da navegação do gerente e recusam a ação no servidor. As ações de operação
(caixa, comanda, encaixe, remarcar, avisos) descobrem a unidade **lendo a linha
do banco**, nunca o campo escondido do formulário — é o que impede um id trocado
de virar um lançamento no caixa da loja vizinha.

## Variáveis do serviço `web`

| Variável | Para quê |
| --- | --- |
| `AMBIENTE` | `producao` ou `teste`. Sem ela, `NODE_ENV=production` já vale como produção |
| `CODIGO_INSTALACAO` | libera `/comecar` enquanto não houver conta de equipe |
| `DATABASE_URL` | referência ao serviço `Postgres` |
| `IMAGE_STORE` | `s3` em produção, `local` no padrão. Ver abaixo |
| `S3_BUCKET` `S3_ENDPOINT` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` `S3_REGION` | credenciais do bucket `imagens`, todas por referência |
| `UPLOAD_DIR` | raiz do driver `local`. Sem efeito com `IMAGE_STORE=s3` |
| `RESEND_API_KEY` `EMAIL_REMETENTE` | as duas juntas ligam o canal de e-mail e a área da cliente |
| `TELEFONES_SUPORTE` | telefones de quem mantém a instalação, separados por vírgula |

### Onde as fotos ficam

Em produção, no bucket `imagens` — **não** no volume de disco. O motivo é uma
frase só: o volume não entra no backup. O dump diário salva o banco, e o banco
guarda o *endereço* da foto, não a foto. Volume perdido é banco íntegro
apontando para o vazio, e a dona fotografando o salão de novo.

O bucket é **separado do `backups`**, e isso não é organização. A poda de
retenção do [backup.sh](backup/backup.sh) lista a raiz do bucket e apaga tudo
que não está entre os 30 arquivos mais recentes: foto no mesmo bucket seria
apagada pelo próprio backup, em silêncio, no trigésimo primeiro dia.

```sh
railway bucket create imagens --region sjc
railway variable set IMAGE_STORE=s3 --service web
# credenciais por referência ao bucket, nunca escritas à mão
```

Quem serve a imagem continua sendo `/api/imagens/<chave>`, não o bucket direto.
Três consequências que valem saber: a coluna `image_url` não mudou de formato,
as fotos gravadas no disco antes da troca continuam abrindo, e quem decide o
`Content-Type` do que sai é a nossa rota, a partir da extensão que ela mesma
validou — nunca o que o bucket devolve.

O driver `local` continua existindo e continua sendo o padrão, para o projeto
rodar recém-clonado sem conta em lugar nenhum. Em produção com mais de uma
instância ele não serve: cada máquina enxerga só o próprio disco.

### Quem é o suporte

```sh
railway variable set TELEFONES_SUPORTE=+5511999999999 --service web
```

Vários vão separados por vírgula. Vazia, ninguém é suporte e as quatro decisões
da tabela acima ficam fechadas para todo mundo — inclusive para nós. É de
propósito: o custo de esquecer é um telefonema, não uma instalação aberta.
Mudar a variável exige redeploy, que o Railway faz sozinho ao salvar.

### Ligar a área da cliente

A cliente entra com o telefone e recebe um código de seis dígitos por e-mail.
Enquanto não houver por onde enviar, `/conta/entrar` não mostra formulário
nenhum — diz que a área está em preparo e manda falar com o salão. Para abrir:

1. Registrar o domínio `.com.br` e verificá-lo no [Resend](https://resend.com)
   (plano grátis: 3.000 e-mails/mês, sem cartão). Sem domínio verificado o
   e-mail cai no spam.
2. `railway variable set RESEND_API_KEY=<a chave> --service web`
3. `railway variable set "EMAIL_REMETENTE=Nohora Ramirez <nao-responda@dominio.com.br>" --service web`

Não há passo de código. A área abre sozinha no deploy seguinte.

Quem não tem e-mail na ficha não consegue entrar — a tela diz isso e manda
falar com o salão. O agendamento já pede o e-mail, então quem marcou pelo site
tem; quem foi cadastrada no balcão pode não ter.

## A dona esqueceu a senha

Com o canal de e-mail ligado ela mesma resolve: **Entrar → Esqueci minha
senha**, telefone, código que chega no e-mail da conta, senha nova. Trocar a
senha derruba todas as sessões abertas com a antiga.

Antes disso — ou se ela perdeu junto o acesso ao e-mail — a saída é aqui. O
comando gera o hash no mesmo formato que o sistema usa (`scrypt`, `salt:hash`)
e grava direto. A senha vai como argumento, nunca colada dentro do SQL:

```sh
railway ssh --service web
# lá dentro, com DATABASE_URL já no ambiente:
node -e '
const {scrypt,randomBytes}=require("node:crypto");
const s=require("postgres")(process.env.DATABASE_URL);
const salt=randomBytes(16).toString("hex");
scrypt(process.argv[2],salt,64,(e,d)=>{
  if(e)throw e;
  s`update users set password_hash = ${salt+":"+d.toString("hex")} where phone = ${process.argv[1]}`
   .then(r=>console.log(r.count===1?"trocada":"telefone nao encontrado"))
   .finally(()=>s.end());
});' "+5511999998888" "senha-provisoria-longa"
```

Combine a senha provisória por telefone, não por e-mail, e peça para ela trocar
no primeiro acesso.
