import type { Dicionario } from './pt'

/**
 * English — en-GB, because the salon is in Portugal and the reader is next
 * door, not across an ocean. "Book" and not "schedule", "stylist" and not
 * "professional", "mobile" and not "cell".
 *
 * A tradução não é literal onde a frase portuguesa depende de imagem: "casa"
 * é a palavra que a Nohora usa para loja, e "house" em inglês seria a casa
 * onde se dorme — aqui é "salon". O tom é que se traduz, não as palavras.
 *
 * O tipo `Dicionario` (= `typeof pt`) obriga a que nada falte. Se este
 * ficheiro compila, as três línguas têm as mesmas chaves.
 */
export const en: Dicionario = {
  comum: {
    marcar: 'Book',
    fechar: 'Close',
    voltar: 'Back',
    total: 'Total',
    sair: 'Sign out',
    opcional: '(optional)',
    aPartirDe: 'from',
    desde: 'from',
    com: 'with',
    noSalao: '{duracao} in the salon',
    cercaDe: 'about {duracao} in the salon',
    servico: 'service',
    servicos: 'services',
    pagamentoNoDia: 'pay on the day',
    telefoneInvalido: 'Invalid phone number. Enter the mobile number with {digitos} digits.',
  },

  dias: {
    longos: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    naFrase: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },

  gramatica: {
    par: '{a} and {b}',
    intervalo: '{a} to {b}',
    enumeracao: '{lista} and {ultimo}',
    ou: '{a} or {b}',
  },

  porta: {
    aberta: 'Open until {hora}',
    abreHoje: 'Opens today at {hora}',
    jaFechou: 'Closed at {hora}',
    fechadaHoje: 'Closed today',
    volta: ' · opens {quando} at {hora}',
    amanha: 'tomorrow',
    encerrado: 'Closed',
  },

  chrome: {
    navCasas: 'Our salons',
    asCasas: 'The salons',
    marcacao: 'Booking',
    marcarOnline: 'Book online',
    asSuasMarcacoes: 'Your bookings',
    areaDaEquipa: 'Team area',
    instagram: 'Instagram',
    idioma: 'Language',
    direitos: '© {ano} {marca}',
  },

  loja: {
    titulo: 'Our salons',
    intro: 'The same team, the same hands, two rooms.',
    marcarEm: 'Book at {loja}',
    verACasa: 'See the salon',
    altSalao: 'Nohora Ramirez salon in {loja}',
    altInterior: 'Inside the {loja} salon',
    galeria: 'Photographs of the {loja} salon',
    fotoAnterior: 'Previous photograph',
    fotoSeguinte: 'Next photograph',
    nestaCasa: 'In this salon',
    seccaoOnde: 'Where to find us',
    seccaoCasa: 'The salon',
    seccaoPrecario: 'Price list',
    morada: 'Address',
    horario: 'Opening hours',
    verNoMapa: 'View on map',
    horarioEspecial: 'Today’s hours are different, and already shown above.',
    fecho: 'Choose your stylist, the day and the time. The booking is confirmed straight away.',
    ouLigue: 'or call {telefone}',
    categoriasDoPrecario: 'Price list categories',
  },

  agendar: {
    passos: ['Salon', 'Services', 'Time', 'Confirm'],
    contador: '{passo} of {total}',
    progresso: 'Step {passo} of {total}: {nome}',

    unidade: {
      titulo: 'Which salon shall we welcome you in?',
      subtitulo:
        'Each salon has its own team and its own diary. Choose whichever is easiest for you.',
      jaCliente: 'Already one of our clients?',
      vejaAsSuas: 'See your bookings',
    },

    servicos: {
      titulo: 'What are we doing today?',
      escolhaUm: 'Choose one or more services',
      verHorarios: 'See times',
      aProcurar: 'Searching…',
      semServicos:
        'This salon has no services available for online booking yet. Please call reception.',
      outros: 'Other',
    },

    horarios: {
      titulo: 'With whom, and when?',
      mudarServicos: 'Change the services',
      servicosEscolhidos: 'Chosen services',
      profissional: 'Stylist',
      semPreferencia: 'No preference',
      dia: 'Day',
      manha: 'Morning',
      tarde: 'Afternoon',
      noite: 'Evening',
      aindaSemHorarios: 'No times yet',
      agendaCheia: 'Fully booked',
      semHorarios: 'no times',
      horariosLivres: '{n} times available',
      quantasProfissionais: '{n} stylists',
      semEquipa:
        'This salon has not published times for these services yet. It is not that the diary is full — online booking for them simply has not opened. Reception books these by phone.',
      semVagaDaProfissional:
        'This stylist has no free time in the next two weeks for this combination.',
      semVagaNenhuma:
        'There is no free time in the next two weeks for this combination of services. It is a long one, and few stylists perform it.',
      verEquipaInteira: 'See the whole team’s diary',
      escolherMenos: 'Choose fewer services',
      verOutraUnidade: 'Try another salon',
      ouRececao: ' · or talk to reception: ',
      diaVazio: 'No free times on this day.',
      diaVazioComProfissional:
        ' Choose another date above, or drop the stylist preference to see the whole team’s diary.',
      diaVazioSemProfissional: ' Choose one of the dates marked above.',
      verTodasAsProfissionais: 'See every stylist',
    },

    confirmar: {
      titulo: 'Check that everything is right',
      mudarHorario: 'Change the time',
      expiradoTitulo: 'This time is no longer free',
      expiradoTexto:
        'Someone booked before you, or the diary changed in the last few minutes. Your services are still chosen — just pick another time.',
      expiradoBotao: 'See times again',
      sinal: 'This treatment asks for a {valor} deposit. Reception sends the payment link by WhatsApp.',
      cancelamento: 'Free cancellation up to {horas}h before. The rest is paid at the salon.',
      nome: 'Your name',
      whatsapp: 'WhatsApp',
      whatsappAjuda: 'This is where the confirmation and the reminder arrive.',
      email: 'Email',
      emailAjuda:
        'So you can follow your bookings on the site. We do not send advertising.',
      emailExemplo: 'name@example.com',
      observacao: 'Anything we should know?',
      observacaoExemplo: 'An allergy, a preference, if you will arrive just in time…',
      aConfirmar: 'Confirming…',
      confirmar: 'Confirm booking',
      semCobranca: 'Confirming holds the time. Nothing is charged now.',
    },

    pronto: {
      tituloComNome: 'You are booked, {nome}.',
      titulo: 'You are booked.',
      sinal: '{valor} deposit — we are sending the payment link to WhatsApp {telefone}.',
      semSinal: 'Nothing to pay now. It is settled at the salon, on the day.',
      marcarOutro: 'Book another service',
      asMinhasMarcacoes: 'My bookings',
      voltarAoInicio: 'Back to the start',
    },

    erros: {
      marcacao: {
        unit_not_found: 'Salon not found.',
        empty_cart: 'Choose at least one service.',
        invalid_start: 'Invalid time.',
        service_unavailable: 'This service is not available at this salon.',
        not_online_bookable: 'This service can only be booked through reception.',
        slot_taken: 'This time has just been taken. Please choose another.',
        too_soon: 'This time is no longer in time. Please choose a later one.',
        too_far: 'The diary is not open for that date yet.',
        already_cancelled: 'This booking has left the diary. To take it back, book again.',
      },
      cota: {
        muitas_recentes:
          'You booked several times just now. Wait a moment, or talk to reception on WhatsApp.',
        muitas_abertas:
          'You already have many bookings. Talk to reception to sort out your diary.',
      },
      nomeCompleto: 'Please give your full name.',
      telefoneIncompleto: 'Incomplete phone number.',
      emailInvalido: 'Invalid email.',
      confiraOsDados: 'Please check your details.',
      unidadeNaoEncontrada: 'Salon not found.',
      naoFoiPossivel: 'We could not book right now.',
      demasiadasTentativas:
        'Too many attempts in a row. Try again in {minutos} {unidade}, or talk to reception.',
      minuto: 'minute',
      minutos: 'minutes',
    },
  },

  conta: {
    ola: 'Hello, {nome}',
    marcarNovo: 'Book a new time',
    proximas: 'Upcoming bookings',
    historico: 'History',
    osMeusDados: 'My details',
    semProximas: 'You have no time booked at the moment.',
    semHistorico: 'You have not visited us yet. Your first time will be recorded here.',
    cancelarPergunta: 'Cancel this booking?',
    aCancelar: 'Cancelling…',
    cancelar: 'Cancel',

    estados: {
      draft: 'draft',
      scheduled: 'booked',
      confirmed: 'confirmed',
      checked_in: 'at reception',
      in_progress: 'in progress',
      completed: 'completed',
      cancelled_by_client: 'cancelled by you',
      cancelled_by_studio: 'cancelled by the salon',
      no_show: 'missed',
    },

    entrar: {
      titulo: 'My account',
      subtitulo: 'Write your phone number and we will send a code to your email.',
      aindaCliente: 'Not one of our clients yet?',
      marqueOPrimeiro: 'Book your first time',
      telefone: 'Phone',
      palavraPasse: 'Password (test sign-in only)',
      aEnviar: 'Sending…',
      receberCodigo: 'Get the code',
      indisponivelSubtitulo: 'The client area is still being prepared.',
      indisponivelTexto:
        'To see, move or cancel a booking, talk to the salon directly — reception sorts it out on the spot.',
      indisponivelSemConta: 'You do not need an account to book a new time:',
      indisponivelLink: 'book here',
    },

    verificar: {
      titulo: 'Write the code',
      comDestino:
        'We sent a code to {destino}, the email on the account {telefone}. It is valid for {minutos} minutes.',
      semDestino:
        'If there is an account on {telefone}, the code has gone to the email registered on it. Nothing arrived? Talk to the salon.',
      codigo: '6-digit code',
      aVerificar: 'Checking…',
      entrar: 'Sign in',
    },

    perfil: {
      nome: 'Name',
      telefone: 'Phone',
      telefoneAjuda:
        'This is how you sign in and how we recognise you. To change it, talk to the salon.',
      email: 'Email',
      emailAjuda:
        'This is where the code goes when you sign in. Use an email you can reach — if you lose it, reception opens the door for you again.',
      emailExemplo: 'name@example.com',
      guardado: 'Saved.',
      aGuardar: 'Saving…',
      guardar: 'Save',
    },

    erros: {
      naoEncontrada: 'Booking not found.',
      naoSePodeCancelar: 'This booking can no longer be cancelled.',
      nomeCompleto: 'Please give your full name.',
      emailInvalido: 'Invalid email.',
      revejaOsCampos: 'Please review the fields.',
      telefoneEmFalta: 'Phone number missing.',
      codigoEmFalta: 'Write the code you received.',
      codigo: {
        expirado: 'Code expired or not found. Please ask for a new one.',
        muitasTentativas: 'Too many attempts. Please ask for a new code.',
        incorreto: 'Wrong code.',
        contaNaoEncontrada: 'Account not found.',
      },
      palavraPasseIncorreta: 'Wrong password.',
      muitasTentativas: 'Too many attempts. Wait a few minutes and try again.',
      areaIndisponivel:
        'The client area is not available yet. Talk to the salon to see or move your bookings.',
      envioFalhou:
        'We could not send the code right now. Try again in a few minutes, or talk to the salon.',
    },
  },

  emails: {
    otpAssunto: '{codigo} is your access code',
    otpCorpo: [
      'Your access code is {codigo}.',
      '',
      'It is valid for {minutos} minutes and can only be used once.',
      '',
      'If this was not you, ignore this email — nobody gets into your account without this code.',
    ].join('\n'),
  },

  mensagens: {
    confirmacao:
      'Hello, {cliente}! Your booking is confirmed 💛\n\n{servicos}\n{data} at {hora}\nwith {profissional}\n\n{unidade}\n{endereco}\n\nAnything at all, just message me here.',
    lembrete_vespera:
      'Hello, {cliente}! Just a reminder about your booking tomorrow 💛\n\n{servicos}\n{data} at {hora}\nwith {profissional}\n\n{unidade}\n{endereco}\n\nCan you make it? If you need to move it, tell me and I will sort it out.',
    bom_dia:
      'Good morning, {cliente}! I am expecting you today at {hora} 💛\n\n{servicos} with {profissional}\n{unidade}',
    avaliacao:
      'Hello, {cliente}! It was lovely to have you yesterday 💛\n\nWere you happy with the result? Your opinion helps us a great deal.',
    resgate:
      'Hello, {cliente}! I missed you at your booking on {data}.\n\nShall I look for a new day for you? Tell me what suits you best and I will fit you in 💛',
  },

  meta: {
    lojaTitulo: 'Our salons',
    lojaDescricao: 'Hair and beauty in {cidades}.',
    lojaOg: 'Nohora Ramirez · Beauty Studio',
    unidadeOg: 'Nohora Ramirez · {loja}',
    marcar: 'Book',
    marcarEm: 'Book · {loja}',
    escolherHorario: 'Choose a time',
    confirmar: 'Confirm',
    marcacaoConfirmada: 'Booking confirmed',
    aMinhaConta: 'My account',
    entrar: 'Sign in',
    verificarCodigo: 'Check the code',
  },
}
