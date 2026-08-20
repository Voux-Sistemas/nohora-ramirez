/**
 * Português — a língua da casa, e a fonte da verdade do dicionário.
 *
 * `Dicionario` é `typeof pt`, e não uma interface escrita à mão. A diferença
 * importa: com uma interface haveria três sítios a manter sincronizados mais o
 * contrato; assim há três, e a forma é sempre a das frases que existem mesmo.
 * Acrescentar uma chave aqui parte imediatamente `en.ts` e `es.ts` no
 * typecheck, que é exactamente o que se quer — uma frase por traduzir tem de
 * doer antes do deploy, não depois, à frente da cliente.
 *
 * Os registos com chave fechada (`erros.marcacao` por `BookingError`,
 * `conta.estados` por estado da marcação, `mensagens` por rotina) ganham de
 * borla a verificação de completude: acrescentar um estado ao domínio parte
 * este ficheiro até a frase existir nas três línguas.
 *
 * Convenções:
 * - `{buraco}` é preenchido por `interpola()`. O teste de paridade confere que
 *   as três línguas pedem os mesmos buracos na mesma chave.
 * - Datas, horas, dinheiro e telefones NÃO estão aqui: saem de `format.ts`,
 *   que já sabe a praça (`pais()`) e recebe a locale da língua à parte.
 * - Nomes de serviços, categorias e notas do preçário vêm da base de dados e
 *   ficam em português nas três línguas. Limitação declarada no PRODUCT.md.
 */

export const pt = {
  comum: {
    marcar: 'Marcar',
    fechar: 'Fechar',
    voltar: 'Voltar',
    total: 'Total',
    sair: 'Sair',
    opcional: '(opcional)',
    aPartirDe: 'a partir de',
    desde: 'desde',
    com: 'com',
    /** `{duracao} no salão` — o tempo que a cadeira fica ocupada. */
    noSalao: '{duracao} no salão',
    cercaDe: 'cerca de {duracao} no salão',
    servico: 'serviço',
    servicos: 'serviços',
    pagamentoNoDia: 'pagamento no dia',
    /* Vive no comum porque duas superfícies a mostram — o formulário de
       marcação e a porta da conta — e porque só o NÚMERO de dígitos sai de
       `pais()`; a frase à volta dele é língua. */
    telefoneInvalido: 'Telefone inválido. Indique o telemóvel com {digitos} dígitos.',
  },

  /** Índice 0 = domingo, como o `getDay()` do JavaScript e o `hoje.ts`. */
  dias: {
    longos: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    /** Em minúsculas, para caírem no meio de uma frase ("abre sexta às 09:00"). */
    naFrase: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'],
  },

  /** As junções que mudam de língua para língua e não são frases inteiras. */
  gramatica: {
    par: '{a} e {b}',
    intervalo: '{a} a {b}',
    /** `Valongo, Maia e Porto` — a lista já vem vírgulada, falta o último. */
    enumeracao: '{lista} e {ultimo}',
    /** Alternativa, não soma: "10 ou 11 dígitos". */
    ou: '{a} ou {b}',
  },

  /** A frase que diz, na montra, se a porta está aberta agora. */
  porta: {
    aberta: 'Aberto até às {hora}',
    abreHoje: 'Abre hoje às {hora}',
    jaFechou: 'Fechou às {hora}',
    fechadaHoje: 'Hoje não abre',
    /** Cola-se ao fim das duas de cima quando se sabe quando volta a abrir. */
    volta: ' · abre {quando} às {hora}',
    amanha: 'amanhã',
    encerrado: 'Encerrado',
  },

  /** Cabeçalho e rodapé da montra. */
  chrome: {
    navCasas: 'As nossas casas',
    asCasas: 'As casas',
    marcacao: 'Marcação',
    marcarOnline: 'Marcar online',

    verAsCasas: 'Ver as casas',
    asSuasMarcacoes: 'As suas marcações',
    areaDaEquipa: 'Área da equipa',
    instagram: 'Instagram',
    idioma: 'Idioma',
    direitos: '© {ano} {marca}',
  },

  loja: {
    titulo: 'As nossas casas',
    intro: 'A mesma equipa, a mesma mão, duas salas.',
    marcarEm: 'Marcar em {loja}',
    verACasa: 'Ver a casa',
    altSalao: 'Salão Nohora Ramirez em {loja}',

    altAbertura: 'Interior do salão Nohora Ramirez',
    altInterior: 'Interior do salão {loja}',
    galeria: 'Fotografias do salão {loja}',
    fotoAnterior: 'Fotografia anterior',
    fotoSeguinte: 'Fotografia seguinte',
    nestaCasa: 'Nesta casa',
    seccaoOnde: 'Onde nos encontra',
    seccaoCasa: 'A casa',
    seccaoPrecario: 'Preçário',
    morada: 'Morada',
    horario: 'Horário',
    verNoMapa: 'Ver no mapa',
    horarioEspecial: 'Hoje o horário é especial e já está considerado acima.',
    fecho: 'Escolha a profissional, o dia e a hora. A marcação fica confirmada no momento.',
    ouLigue: 'ou ligue {telefone}',
    categoriasDoPrecario: 'Categorias do preçário',
  },

  agendar: {
    passos: ['Unidade', 'Serviços', 'Horário', 'Confirmar'],
    contador: '{passo} de {total}',
    progresso: 'Passo {passo} de {total}: {nome}',

    unidade: {
      titulo: 'Em que casa a recebemos?',
      subtitulo: 'Cada casa tem a sua equipa e a sua agenda. Escolha a que lhe fica mais à mão.',
      jaCliente: 'Já é nossa cliente?',
      vejaAsSuas: 'Veja as suas marcações',
    },

    servicos: {
      titulo: 'O que vai fazer hoje?',
      escolhaUm: 'Escolha um ou mais serviços',
      verHorarios: 'Ver horários',
      aProcurar: 'A procurar…',
      semServicos:
        'Esta unidade ainda não tem serviços disponíveis para marcação online. Ligue para a receção.',
      /** Cai aqui o serviço sem categoria — não é decoração, é o balde. */
      outros: 'Outros',
    },

    horarios: {
      titulo: 'Com quem, e quando?',
      mudarServicos: 'Mudar os serviços',
      servicosEscolhidos: 'Serviços escolhidos',
      profissional: 'Profissional',
      semPreferencia: 'Sem preferência',
      dia: 'Dia',
      manha: 'Manhã',
      tarde: 'Tarde',
      noite: 'Noite',
      aindaSemHorarios: 'Ainda sem horários',
      agendaCheia: 'Agenda cheia',
      semHorarios: 'sem horários',
      horariosLivres: '{n} horários livres',
      quantasProfissionais: '{n} profissionais',
      /** A casa não publicou escala nenhuma para esta combinação. */
      semEquipa:
        'Esta casa ainda não publicou horário para estes serviços. Não é que esteja cheia — é que a marcação online para eles ainda não abriu. A receção marca por telefone.',
      /** Escolheu profissional e essa não tem vaga. */
      semVagaDaProfissional:
        'Esta profissional não tem nenhum horário livre nas próximas duas semanas para esta combinação.',
      /** Ninguém tem vaga — normalmente porque o carrinho ficou longo. */
      semVagaNenhuma:
        'Não há horário livre nas próximas duas semanas para esta combinação de serviços. É longa e poucas profissionais a executam.',
      verEquipaInteira: 'Ver a agenda da equipa inteira',
      escolherMenos: 'Escolher menos serviços',
      verOutraUnidade: 'Ver outra unidade',
      ouRececao: ' · ou fale com a receção: ',
      diaVazio: 'Nenhum horário livre neste dia.',
      diaVazioComProfissional:
        ' Escolha outra data acima, ou tire a preferência de profissional para ver a agenda da equipa inteira.',
      diaVazioSemProfissional: ' Escolha uma das datas marcadas acima.',
      verTodasAsProfissionais: 'Ver todos os profissionais',
    },

    confirmar: {
      titulo: 'Confira se está tudo certo',
      mudarHorario: 'Mudar o horário',
      expiradoTitulo: 'Este horário já não está livre',
      expiradoTexto:
        'Alguém marcou antes ou a agenda mudou nos últimos minutos. Os seus serviços continuam escolhidos — é só escolher outro horário.',
      expiradoBotao: 'Ver horários de novo',
      sinal: 'Este procedimento pede sinal de {valor}. A receção envia o link de pagamento pelo WhatsApp.',
      cancelamento:
        'Cancelamento sem custo até {horas}h antes. O restante é pago no salão.',
      nome: 'O seu nome',
      whatsapp: 'WhatsApp',
      whatsappAjuda: 'É por aqui que a confirmação e o lembrete chegam.',
      email: 'E-mail',
      emailAjuda:
        'Para poder acompanhar as suas marcações pelo site. Não enviamos publicidade.',
      emailExemplo: 'nome@exemplo.com',
      observacao: 'Alguma observação?',
      observacaoExemplo: 'Alergia, preferência, se vai chegar em cima da hora…',
      aConfirmar: 'A confirmar…',
      confirmar: 'Confirmar marcação',
      semCobranca: 'Ao confirmar, reserva o horário. Não é cobrado nada agora.',
    },

    pronto: {
      tituloComNome: 'Está marcado, {nome}.',
      titulo: 'Está marcado.',
      sinal: 'Sinal de {valor} — enviamos o link de pagamento para o WhatsApp {telefone}.',
      semSinal: 'Nada a pagar agora. O acerto é no salão, no dia.',
      marcarOutro: 'Marcar outro serviço',
      asMinhasMarcacoes: 'As minhas marcações',
      voltarAoInicio: 'Voltar ao início',
    },

    erros: {
      /** Chaveado por `BookingError` — o domínio garante que não falta nenhum. */
      marcacao: {
        unit_not_found: 'Unidade não encontrada.',
        empty_cart: 'Escolha pelo menos um serviço.',
        invalid_start: 'Horário inválido.',
        service_unavailable: 'Este serviço não está disponível nesta unidade.',
        not_online_bookable: 'Este serviço só pode ser marcado pela receção.',
        slot_taken: 'Este horário acabou de ser ocupado. Escolha outro, por favor.',
        too_soon: 'Este horário já não está a tempo. Escolha um mais à frente, por favor.',
        too_far: 'A agenda ainda não está aberta para essa data.',
        already_cancelled: 'Esta marcação já saiu da agenda. Para a retomar, marque de novo.',
      },
      /** Travões de volume — a cliente não tem culpa, o tom não a acusa. */
      cota: {
        muitas_recentes:
          'Marcou vários horários agora há pouco. Espere um pouco ou fale com a receção pelo WhatsApp.',
        muitas_abertas: 'Já tem muitas marcações. Fale com a receção para organizar a sua agenda.',
      },
      nomeCompleto: 'Diga o seu nome completo.',
      telefoneIncompleto: 'Telefone incompleto.',
      emailInvalido: 'E-mail inválido.',
      confiraOsDados: 'Confira os dados.',
      unidadeNaoEncontrada: 'Unidade não encontrada.',
      naoFoiPossivel: 'Não foi possível marcar agora.',
      demasiadasTentativas:
        'Muitas tentativas seguidas. Tente de novo em {minutos} {unidade} ou fale com a receção.',
      minuto: 'minuto',
      minutos: 'minutos',
    },
  },

  conta: {
    ola: 'Olá, {nome}',
    marcarNovo: 'Marcar novo horário',
    proximas: 'Próximas marcações',
    historico: 'Histórico',
    osMeusDados: 'Os meus dados',
    semProximas: 'Não tem nenhum horário marcado neste momento.',
    semHistorico: 'Ainda não nos visitou. A primeira vez fica registada aqui.',
    cancelarPergunta: 'Cancelar esta marcação?',
    aCancelar: 'A cancelar…',
    cancelar: 'Cancelar',

    /**
     * Chaveado pelo estado da marcação. É o vocabulário DA CLIENTE, não o da
     * equipa: aqui "cancelado por si" diz-lhe quem cancelou de forma que ela
     * reconhece, enquanto o `STATUS_LABEL` da agenda fala do outro lado do
     * balcão.
     */
    estados: {
      draft: 'rascunho',
      scheduled: 'marcado',
      confirmed: 'confirmado',
      checked_in: 'na receção',
      in_progress: 'em atendimento',
      completed: 'concluído',
      cancelled_by_client: 'cancelado por si',
      cancelled_by_studio: 'cancelado pelo salão',
      no_show: 'não compareceu',
    },

    entrar: {
      titulo: 'A minha conta',
      subtitulo: 'Escreva o seu telefone e enviamos um código para o seu e-mail.',
      aindaCliente: 'Ainda não é nossa cliente?',
      marqueOPrimeiro: 'Marque o primeiro horário',
      telefone: 'Telefone',
      palavraPasse: 'Palavra-passe (só para login de teste)',
      aEnviar: 'A enviar…',
      receberCodigo: 'Receber código',
      /** Quando não há e-mail configurado, a porta fecha-se com jeito. */
      indisponivelSubtitulo: 'A área da cliente ainda está em preparação.',
      indisponivelTexto:
        'Para ver, remarcar ou cancelar um horário, fale diretamente com o salão — a receção resolve na hora.',
      indisponivelSemConta: 'Para marcar um novo horário não precisa de conta:',
      indisponivelLink: 'agende por aqui',
    },

    verificar: {
      titulo: 'Escreva o código',
      comDestino:
        'Enviámos um código para {destino}, o e-mail da conta {telefone}. Ele vale por {minutos} minutos.',
      semDestino:
        'Se houver conta em {telefone}, o código já foi para o e-mail registado nela. Não chegou nada? Fale com o salão.',
      codigo: 'Código de 6 dígitos',
      aVerificar: 'A verificar…',
      entrar: 'Entrar',
    },

    perfil: {
      nome: 'Nome',
      telefone: 'Telefone',
      telefoneAjuda:
        'É por aqui que entra e que a reconhecemos. Para mudar, fale com o salão.',
      email: 'E-mail',
      emailAjuda:
        'É para aqui que vai o código quando entrar. Use um e-mail a que tenha acesso — se ficar sem, a receção volta a abrir-lhe a porta.',
      emailExemplo: 'nome@exemplo.com',
      guardado: 'Guardado.',
      aGuardar: 'A guardar…',
      guardar: 'Guardar',
    },

    erros: {
      naoEncontrada: 'Marcação não encontrada.',
      naoSePodeCancelar: 'Esta marcação já não pode ser cancelada.',
      nomeCompleto: 'Diga o seu nome completo.',
      emailInvalido: 'E-mail inválido.',
      revejaOsCampos: 'Reveja os campos.',
      telefoneEmFalta: 'Telefone não informado.',
      codigoEmFalta: 'Digite o código recebido.',
      /**
       * Chaveado por `MotivoLogin` (`server/auth/otp.ts`). "Expirado" e
       * "inexistente" dizem a mesma coisa de propósito: o que ela precisa de
       * saber é que tem de pedir outro.
       */
      codigo: {
        expirado: 'Código expirado ou inexistente. Peça um novo.',
        muitasTentativas: 'Muitas tentativas. Peça um novo código.',
        incorreto: 'Código incorreto.',
        contaNaoEncontrada: 'Conta não encontrada.',
      },
      palavraPasseIncorreta: 'Palavra-passe incorreta.',
      muitasTentativas: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
      areaIndisponivel:
        'A área da cliente ainda não está disponível. Fale com o salão para ver ou remarcar as suas marcações.',
      envioFalhou:
        'Não conseguimos enviar o código agora. Tente de novo em alguns minutos ou fale com o salão.',
    },
  },

  emails: {
    otpAssunto: '{codigo} é o seu código de acesso',
    otpCorpo: [
      'O seu código de acesso é {codigo}.',
      '',
      'Ele vale por {minutos} minutos e só pode ser usado uma vez.',
      '',
      'Se o pedido não partiu de si, ignore este e-mail — ninguém entra na sua conta sem este código.',
    ].join('\n'),
  },

  /**
   * Corpos de WhatsApp, chaveados por `RoutineKey`. Vão para a cliente na
   * língua dela — não na de quem carrega no botão. As variáveis são as do
   * `MessageVars` das notificações.
   */
  mensagens: {
    confirmacao:
      'Olá, {cliente}! A sua marcação está confirmada 💛\n\n{servicos}\n{data} às {hora}\ncom {profissional}\n\n{unidade}\n{endereco}\n\nQualquer coisa, é só falar comigo por aqui.',
    lembrete_vespera:
      'Olá, {cliente}! É só para lembrar da sua marcação de amanhã 💛\n\n{servicos}\n{data} às {hora}\ncom {profissional}\n\n{unidade}\n{endereco}\n\nConsegue vir? Se precisar de remarcar, avise-me que eu trato disso.',
    bom_dia:
      'Bom dia, {cliente}! Espero por si hoje às {hora} 💛\n\n{servicos} com {profissional}\n{unidade}',
    avaliacao:
      'Olá, {cliente}! Que bom tê-la recebido ontem 💛\n\nFicou contente com o resultado? A sua opinião ajuda-nos muito a melhorar.',
    resgate:
      'Olá, {cliente}! Senti a sua falta na marcação de {data}.\n\nQuer que eu procure um novo dia para si? Diga-me o que lhe fica melhor e eu encaixo 💛',
  },

  meta: {
    lojaTitulo: 'As nossas casas',
    lojaDescricao: 'Cabeleireiro e estética em {cidades}.',
    lojaOg: 'Nohora Ramirez · Beauty Studio',
    unidadeOg: 'Nohora Ramirez · {loja}',
    marcar: 'Marcar',
    marcarEm: 'Marcar · {loja}',
    escolherHorario: 'Escolher horário',
    confirmar: 'Confirmar',
    marcacaoConfirmada: 'Marcação confirmada',
    aMinhaConta: 'A minha conta',
    entrar: 'Entrar',
    verificarCodigo: 'Verificar código',
  },
}

/**
 * A forma do dicionário É o português. `en.ts` e `es.ts` declaram-se com este
 * tipo e o compilador exige delas exactamente as mesmas chaves.
 */
export type Dicionario = typeof pt
