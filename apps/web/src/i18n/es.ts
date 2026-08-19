import type { Dicionario } from './pt'

/**
 * Espanhol — es-ES, e sempre na forma de «usted».
 *
 * O tratamento não é escolha de estilo: o português da casa trata a cliente
 * por «a senhora» sem o dizer (é «Escolha», nunca «Escolhe»), e passar a «tú»
 * em espanhol mudaria a casa, não só a língua.
 *
 * É a única das três línguas que vai ser lida por quem a fala de nascença — a
 * Nohora é colombiana. Por isso o vocabulário é o dela: «clienta», «salón»,
 * «señal», e nada de «su reserva ha sido procesada».
 */
export const es: Dicionario = {
  comum: {
    marcar: 'Reservar',
    fechar: 'Cerrar',
    voltar: 'Volver',
    total: 'Total',
    sair: 'Salir',
    opcional: '(opcional)',
    aPartirDe: 'desde',
    desde: 'desde',
    com: 'con',
    noSalao: '{duracao} en el salón',
    cercaDe: 'unos {duracao} en el salón',
    servico: 'servicio',
    servicos: 'servicios',
    pagamentoNoDia: 'pago el mismo día',
    telefoneInvalido: 'Teléfono no válido. Indique el móvil con {digitos} dígitos.',
  },

  dias: {
    longos: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    naFrase: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  },

  gramatica: {
    par: '{a} y {b}',
    intervalo: '{a} a {b}',
    enumeracao: '{lista} y {ultimo}',
    ou: '{a} o {b}',
  },

  porta: {
    aberta: 'Abierto hasta las {hora}',
    abreHoje: 'Abre hoy a las {hora}',
    jaFechou: 'Cerró a las {hora}',
    fechadaHoje: 'Hoy no abre',
    volta: ' · abre {quando} a las {hora}',
    amanha: 'mañana',
    encerrado: 'Cerrado',
  },

  chrome: {
    navCasas: 'Nuestros salones',
    asCasas: 'Los salones',
    marcacao: 'Reservas',
    marcarOnline: 'Reservar en línea',
    asSuasMarcacoes: 'Sus reservas',
    areaDaEquipa: 'Área del equipo',
    instagram: 'Instagram',
    idioma: 'Idioma',
    direitos: '© {ano} {marca}',
  },

  loja: {
    titulo: 'Nuestros salones',
    intro: 'El mismo equipo, la misma mano, dos salas.',
    marcarEm: 'Reservar en {loja}',
    verACasa: 'Ver el salón',
    altSalao: 'Salón Nohora Ramirez en {loja}',
    altInterior: 'Interior del salón {loja}',
    galeria: 'Fotografías del salón {loja}',
    fotoAnterior: 'Fotografía anterior',
    fotoSeguinte: 'Fotografía siguiente',
    nestaCasa: 'En este salón',
    seccaoOnde: 'Dónde encontrarnos',
    seccaoCasa: 'El salón',
    seccaoPrecario: 'Tarifas',
    morada: 'Dirección',
    horario: 'Horario',
    verNoMapa: 'Ver en el mapa',
    horarioEspecial: 'Hoy el horario es especial y ya está reflejado arriba.',
    fecho: 'Elija a la profesional, el día y la hora. La reserva queda confirmada al momento.',
    ouLigue: 'o llame al {telefone}',
    categoriasDoPrecario: 'Categorías de tarifas',
  },

  agendar: {
    passos: ['Salón', 'Servicios', 'Hora', 'Confirmar'],
    contador: '{passo} de {total}',
    progresso: 'Paso {passo} de {total}: {nome}',

    unidade: {
      titulo: '¿En qué salón la recibimos?',
      subtitulo:
        'Cada salón tiene su equipo y su agenda. Elija el que le quede más a mano.',
      jaCliente: '¿Ya es nuestra clienta?',
      vejaAsSuas: 'Vea sus reservas',
    },

    servicos: {
      titulo: '¿Qué se va a hacer hoy?',
      escolhaUm: 'Elija uno o más servicios',
      verHorarios: 'Ver horarios',
      aProcurar: 'Buscando…',
      semServicos:
        'Este salón todavía no tiene servicios disponibles para reservar en línea. Llame a recepción.',
      outros: 'Otros',
    },

    horarios: {
      titulo: '¿Con quién y cuándo?',
      mudarServicos: 'Cambiar los servicios',
      servicosEscolhidos: 'Servicios elegidos',
      profissional: 'Profesional',
      semPreferencia: 'Sin preferencia',
      dia: 'Día',
      manha: 'Mañana',
      tarde: 'Tarde',
      noite: 'Noche',
      aindaSemHorarios: 'Aún sin horarios',
      agendaCheia: 'Agenda completa',
      semHorarios: 'sin horarios',
      horariosLivres: '{n} horarios libres',
      quantasProfissionais: '{n} profesionales',
      semEquipa:
        'Este salón todavía no ha publicado horarios para estos servicios. No es que esté lleno — es que la reserva en línea para ellos aún no ha abierto. Recepción los agenda por teléfono.',
      semVagaDaProfissional:
        'Esta profesional no tiene ningún horario libre en las próximas dos semanas para esta combinación.',
      semVagaNenhuma:
        'No hay horario libre en las próximas dos semanas para esta combinación de servicios. Es larga y pocas profesionales la realizan.',
      verEquipaInteira: 'Ver la agenda de todo el equipo',
      escolherMenos: 'Elegir menos servicios',
      verOutraUnidade: 'Ver otro salón',
      ouRececao: ' · o hable con recepción: ',
      diaVazio: 'Ningún horario libre en este día.',
      diaVazioComProfissional:
        ' Elija otra fecha arriba, o quite la preferencia de profesional para ver la agenda de todo el equipo.',
      diaVazioSemProfissional: ' Elija una de las fechas marcadas arriba.',
      verTodasAsProfissionais: 'Ver todas las profesionales',
    },

    confirmar: {
      titulo: 'Compruebe que todo está bien',
      mudarHorario: 'Cambiar la hora',
      expiradoTitulo: 'Esta hora ya no está libre',
      expiradoTexto:
        'Alguien reservó antes o la agenda cambió en los últimos minutos. Sus servicios siguen elegidos — solo hay que elegir otra hora.',
      expiradoBotao: 'Ver horarios de nuevo',
      sinal: 'Este procedimiento pide una señal de {valor}. Recepción envía el enlace de pago por WhatsApp.',
      cancelamento: 'Cancelación sin coste hasta {horas}h antes. El resto se paga en el salón.',
      nome: 'Su nombre',
      whatsapp: 'WhatsApp',
      whatsappAjuda: 'Es por aquí que llegan la confirmación y el recordatorio.',
      email: 'Correo electrónico',
      emailAjuda:
        'Para poder seguir sus reservas por el sitio. No enviamos publicidad.',
      emailExemplo: 'nombre@ejemplo.com',
      observacao: '¿Alguna observación?',
      observacaoExemplo: 'Alergia, preferencia, si va a llegar justo a la hora…',
      aConfirmar: 'Confirmando…',
      confirmar: 'Confirmar reserva',
      semCobranca: 'Al confirmar, la hora queda reservada. No se cobra nada ahora.',
    },

    pronto: {
      tituloComNome: 'Ya está reservado, {nome}.',
      titulo: 'Ya está reservado.',
      sinal: 'Señal de {valor} — le enviamos el enlace de pago al WhatsApp {telefone}.',
      semSinal: 'Nada que pagar ahora. La cuenta se salda en el salón, el mismo día.',
      marcarOutro: 'Reservar otro servicio',
      asMinhasMarcacoes: 'Mis reservas',
      voltarAoInicio: 'Volver al inicio',
    },

    erros: {
      marcacao: {
        unit_not_found: 'Salón no encontrado.',
        empty_cart: 'Elija al menos un servicio.',
        invalid_start: 'Hora no válida.',
        service_unavailable: 'Este servicio no está disponible en este salón.',
        not_online_bookable: 'Este servicio solo se puede reservar por recepción.',
        slot_taken: 'Esta hora acaba de ocuparse. Elija otra, por favor.',
        too_soon: 'Esta hora ya no llega a tiempo. Elija una más adelante, por favor.',
        too_far: 'La agenda todavía no está abierta para esa fecha.',
        already_cancelled: 'Esta reserva ya salió de la agenda. Para retomarla, reserve de nuevo.',
      },
      cota: {
        muitas_recentes:
          'Ha reservado varias horas hace muy poco. Espere un momento o hable con recepción por WhatsApp.',
        muitas_abertas:
          'Ya tiene muchas reservas. Hable con recepción para organizar su agenda.',
      },
      nomeCompleto: 'Escriba su nombre completo.',
      telefoneIncompleto: 'Teléfono incompleto.',
      emailInvalido: 'Correo electrónico no válido.',
      confiraOsDados: 'Compruebe los datos.',
      unidadeNaoEncontrada: 'Salón no encontrado.',
      naoFoiPossivel: 'No se ha podido reservar ahora.',
      demasiadasTentativas:
        'Demasiados intentos seguidos. Inténtelo de nuevo en {minutos} {unidade} o hable con recepción.',
      minuto: 'minuto',
      minutos: 'minutos',
    },
  },

  conta: {
    ola: 'Hola, {nome}',
    marcarNovo: 'Reservar una nueva hora',
    proximas: 'Próximas reservas',
    historico: 'Historial',
    osMeusDados: 'Mis datos',
    semProximas: 'No tiene ninguna hora reservada en este momento.',
    semHistorico: 'Todavía no nos ha visitado. La primera vez queda registrada aquí.',
    cancelarPergunta: '¿Cancelar esta reserva?',
    aCancelar: 'Cancelando…',
    cancelar: 'Cancelar',

    estados: {
      draft: 'borrador',
      scheduled: 'reservado',
      confirmed: 'confirmado',
      checked_in: 'en recepción',
      in_progress: 'en atención',
      completed: 'completado',
      cancelled_by_client: 'cancelado por usted',
      cancelled_by_studio: 'cancelado por el salón',
      no_show: 'no asistió',
    },

    entrar: {
      titulo: 'Mi cuenta',
      subtitulo: 'Escriba su teléfono y le enviamos un código a su correo electrónico.',
      aindaCliente: '¿Todavía no es nuestra clienta?',
      marqueOPrimeiro: 'Reserve su primera hora',
      telefone: 'Teléfono',
      palavraPasse: 'Contraseña (solo para el inicio de sesión de prueba)',
      aEnviar: 'Enviando…',
      receberCodigo: 'Recibir código',
      indisponivelSubtitulo: 'El área de la clienta todavía está en preparación.',
      indisponivelTexto:
        'Para ver, cambiar o cancelar una hora, hable directamente con el salón — recepción lo resuelve al momento.',
      indisponivelSemConta: 'Para reservar una nueva hora no necesita cuenta:',
      indisponivelLink: 'reserve por aquí',
    },

    verificar: {
      titulo: 'Escriba el código',
      comDestino:
        'Enviamos un código a {destino}, el correo de la cuenta {telefone}. Es válido durante {minutos} minutos.',
      semDestino:
        'Si hay una cuenta en {telefone}, el código ya salió al correo registrado en ella. ¿No llegó nada? Hable con el salón.',
      codigo: 'Código de 6 dígitos',
      aVerificar: 'Comprobando…',
      entrar: 'Entrar',
    },

    perfil: {
      nome: 'Nombre',
      telefone: 'Teléfono',
      telefoneAjuda:
        'Es por aquí que entra y que la reconocemos. Para cambiarlo, hable con el salón.',
      email: 'Correo electrónico',
      emailAjuda:
        'Es adonde va el código cuando entra. Use un correo al que tenga acceso — si lo pierde, recepción le vuelve a abrir la puerta.',
      emailExemplo: 'nombre@ejemplo.com',
      guardado: 'Guardado.',
      aGuardar: 'Guardando…',
      guardar: 'Guardar',
    },

    erros: {
      naoEncontrada: 'Reserva no encontrada.',
      naoSePodeCancelar: 'Esta reserva ya no se puede cancelar.',
      nomeCompleto: 'Escriba su nombre completo.',
      emailInvalido: 'Correo electrónico no válido.',
      revejaOsCampos: 'Revise los campos.',
      telefoneEmFalta: 'Falta el teléfono.',
      codigoEmFalta: 'Escriba el código recibido.',
      codigo: {
        expirado: 'Código caducado o inexistente. Pida uno nuevo.',
        muitasTentativas: 'Demasiados intentos. Pida un código nuevo.',
        incorreto: 'Código incorrecto.',
        contaNaoEncontrada: 'Cuenta no encontrada.',
      },
      palavraPasseIncorreta: 'Contraseña incorrecta.',
      muitasTentativas: 'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.',
      areaIndisponivel:
        'El área de la clienta todavía no está disponible. Hable con el salón para ver o cambiar sus reservas.',
      envioFalhou:
        'No hemos podido enviar el código ahora. Inténtelo de nuevo en unos minutos o hable con el salón.',
    },
  },

  emails: {
    otpAssunto: '{codigo} es su código de acceso',
    otpCorpo: [
      'Su código de acceso es {codigo}.',
      '',
      'Es válido durante {minutos} minutos y solo se puede usar una vez.',
      '',
      'Si no ha sido usted, ignore este correo — nadie entra en su cuenta sin este código.',
    ].join('\n'),
  },

  mensagens: {
    confirmacao:
      '¡Hola, {cliente}! Su reserva está confirmada 💛\n\n{servicos}\n{data} a las {hora}\ncon {profissional}\n\n{unidade}\n{endereco}\n\nCualquier cosa, hábleme por aquí.',
    lembrete_vespera:
      '¡Hola, {cliente}! Solo para recordarle su reserva de mañana 💛\n\n{servicos}\n{data} a las {hora}\ncon {profissional}\n\n{unidade}\n{endereco}\n\n¿Puede venir? Si necesita cambiarla, avíseme y yo me encargo.',
    bom_dia:
      '¡Buenos días, {cliente}! La espero hoy a las {hora} 💛\n\n{servicos} con {profissional}\n{unidade}',
    avaliacao:
      '¡Hola, {cliente}! Qué bueno haberla recibido ayer 💛\n\n¿Quedó contenta con el resultado? Su opinión nos ayuda muchísimo.',
    resgate:
      '¡Hola, {cliente}! La eché de menos en su reserva del {data}.\n\n¿Quiere que le busque un nuevo día? Dígame cuál le viene mejor y se lo encajo 💛',
  },

  meta: {
    lojaTitulo: 'Nuestros salones',
    lojaDescricao: 'Peluquería y estética en {cidades}.',
    lojaOg: 'Nohora Ramirez · Beauty Studio',
    unidadeOg: 'Nohora Ramirez · {loja}',
    marcar: 'Reservar',
    marcarEm: 'Reservar · {loja}',
    escolherHorario: 'Elegir horario',
    confirmar: 'Confirmar',
    marcacaoConfirmada: 'Reserva confirmada',
    aMinhaConta: 'Mi cuenta',
    entrar: 'Entrar',
    verificarCodigo: 'Verificar código',
  },
}
