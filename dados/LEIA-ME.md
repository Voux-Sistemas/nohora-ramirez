# O formato de importação, em nove ficheiros

Estes nove `.csv` são **material de referência**: mostram, coluna a coluna, o
formato em que o sistema espera receber os dados de um salão novo. Não são
pré-requisito para arrancar nada — o sistema sobe com o seed e funciona sem eles
(ADR-008 em `docs/DECISOES.md`). Servem para duas coisas:

- **recolher os dados junto da dona** antes de os escrever em `/admin`, na ordem
  em que os ecrãs os pedem (a ordem de registo está em `ops/onboarding.md`);
- **fixar o formato** que o onboarding vai ler quando for construído.

O conteúdo que está aqui é exemplo — um salão inventado no distrito do Porto,
com três lojas.

> **Os ficheiros com dados a sério vão para `dados/real/`, não por cima destes.**
> Essa pasta está no `.gitignore`: nome, telemóvel e e-mail de clientes de
> verdade não entram no repositório. Copie o modelo para lá (`dados/real/
> 10-clientes.csv`) e preencha a cópia. Os nove daqui ficam como estão, que é
> para isso que servem — mostrar o formato à próxima pessoa.

Só o `10-clientes.csv` entra sozinho no sistema, pelo ecrã *Clientes →
Importar*. Os outros oito são para preencher à mão nos formulários.

| Ordem | Ficheiro | O que carrega |
|---|---|---|
| 1 | `01-unidades.csv` | as lojas. Sem unidade não existe agenda, equipa nem caixa |
| 2 | `02-horarios-funcionamento.csv` | quando cada loja abre — é o que define onde há agenda |
| 3 | `05-servicos.csv` | **o mais importante.** Preço e duração; duração errada é agenda errada |
| 4 | `03-profissionais.csv` | quem são e em que lojas atendem |
| 5 | `06-quem-faz-o-que.csv` | sem isto a cliente marca com quem não faz aquele serviço |
| 6 | `04-escalas.csv` | quando cada uma trabalha. Sem escala a profissional não tem coluna na agenda |
| 7 | `07-recursos.csv` | lavatórios, cadeiras e cabines — é o que impede duas clientes na mesma cabine |
| 8 | `08-precos-excecoes.csv` | só se o preço variar por profissional ou por loja |
| 9 | `10-clientes.csv` | a carteira de clientes — o único que o sistema importa sozinho |

A ordem da tabela não é a ordem dos números no nome do ficheiro: é a ordem em
que os dados fazem falta. Cada linha depende de a anterior já estar respondida —
o catálogo antes da equipa, porque a ficha da profissional marca os serviços que
ela executa.

## Como preencher

- Abra os `.csv` na folha de cálculo (Excel, Numbers, Google Sheets). O
  separador aqui é **ponto e vírgula (`;`)**, que é o que o Excel em português
  grava, porque a vírgula já é o separador decimal.
- Não é preciso acertar o separador antes de enviar: o leitor de CSV descobre-o
  sozinho a partir do cabeçalho — aceita `;`, `,` ou tabulação — e ignora o BOM
  que o Excel escreve no início do ficheiro (`packages/core/src/csv/parse.ts`).
- Não precisa de ficar bonito. Se for mais fácil mandar fotografia do caderno ou
  a folha que o salão já usa, mande; converte-se depois.

## O campo que mais gera dúvida: a duração do serviço

- **`duracao_min`** — o tempo total da cliente com a profissional, do princípio
  ao fim. Numa coloração conta tudo: aplicar, esperar que a tinta atue e
  finalizar. Se a coloração leva 1h40, escreva `100`.
- **`folga_depois_min`** — o tempo de limpeza e troca entre uma cliente e a
  seguinte. Se são sempre 10 minutos a arrumar a estação, escreva 10.

Duração errada é o erro que mais dói: a agenda passa a prometer horário que não
existe. Na dúvida, cronometre dois atendimentos e use o maior — errar para mais
deixa a cabeleireira à espera, errar para menos põe duas clientes na mesma
cadeira.

## Convenções que valem para todos os ficheiros

- **Coluna em branco = herda ou não se aplica.** Em `08-precos-excecoes.csv`, se
  preencher só o preço e deixar a duração vazia, fica a duração base do serviço.
  Em `02-horarios-funcionamento.csv`, `abre` e `fecha` vazios significam
  **fechado nesse dia**.
- **Código** (`centro`, `ana`, `corte-senhora`) é o nome curto que amarra um
  ficheiro ao outro. Minúsculas, sem acento e sem espaço — e repetido
  exatamente igual nos outros ficheiros.
- **Dinheiro em euros, com vírgula decimal:** `50,00`. Sem o símbolo `€` e sem
  separador de milhares.
- **Listas dentro de uma célula** separadas por vírgula, sem espaço:
  `corte-senhora,brushing,coloracao`.
- **Sim/não** escreve-se `sim` ou `nao`.
- **Telemóvel português tem nove dígitos** e começa por 9; o fixo do Porto começa
  por 22. Escreva-os como quiser (`912 345 678`, `912345678`), que o sistema
  normaliza. Código postal no formato `4440-123`, e a região é o **distrito**
  (`Porto`), não uma sigla de duas letras.

### Sobre `08-precos-excecoes.csv`

Só se preenche se o preço ou a duração mudarem nalgum caso. A regra de
desempate, da mais específica para a mais genérica:

```
profissional + unidade  →  profissional  →  unidade  →  preço base do serviço
```

Ou seja: se a Ana cobra mais caro por madeixas em qualquer loja, é uma linha com
`profissional=ana` e `unidade` vazia.

### Sobre `10-clientes.csv`

É o único ficheiro que entra sozinho no sistema, em *Clientes → Importar* — o
ecrã pede sessão de gestão, porque importar cria fichas de gente.

Só duas colunas são obrigatórias: `nome` e `telefone`. O `email` pode ficar em
branco à vontade. O cabeçalho é lido por nome, e as variantes reconhecidas estão
em `apps/web/src/app/clientes/importar/actions.ts`: para o número servem
`telefone`, `telemóvel`, `telemovel`, `contacto`, `celular` ou `phone`; para o
nome, `nome` ou `name`. Uma coluna com outro nome qualquer é ignorada em
silêncio, e a importação parece vazia sem ninguém desconfiar do cabeçalho.

O número pode vir como estiver na agenda do salão — `912 345 678`, `912345678`,
`+351 912 345 678` ou `00351912345678`. O sistema arruma. O que ele não arruma é
falta de dígitos: com `PAIS=PT` só passam os nove dígitos nacionais, e a linha
que não os tiver é saltada e devolvida na lista de ignoradas, com o motivo.

**Quem já existe não vira cópia.** A conferência é pelo telemóvel: se a cliente
já está registada, a linha não cria uma segunda — quando muito preenche o
e-mail que faltava, e nunca por cima de um que já lá esteja. O nome também não é
substituído. Então dá para reenviar o ficheiro depois de o completar, sem medo
de duplicar ninguém.
