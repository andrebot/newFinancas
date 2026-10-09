import type { Notification } from '@financas/api-types';

/** Every notification type in the API contract, plus the generic fallback (OQ-82). */
type NotificationKey = Notification['type'] | 'fallback';

/**
 * pt-BR catalog — the primary locale, and the source of the key set every other
 * locale must translate (NFR-I18N-3). Messages are ICU MessageFormat.
 *
 * - `errors`: API error `code`s (OQ-83); `fallback` covers unknown codes.
 * - `fields`: validation `details[].code`s.
 * - `notifications`: notification `type`s (OQ-82); people arrive already resolved
 *   to names (`inviterName`), dates already formatted (NFR-I18N-2).
 * - `emails`: `<type>.subject` / `<type>.body` for the email channel (OQ-84).
 */
const ptBR = {
  errors: {
    fallback: 'Algo deu errado.',
    'validation.failed': 'Alguns campos precisam de correção.',
    'request.invalid': 'Não foi possível processar a solicitação.',
    'route.not_found': 'Recurso não encontrado.',
    'internal.unexpected': 'Algo deu errado. Tente novamente.',
    'auth.forbidden': 'Você não tem permissão para fazer isso.',
    'auth.invalid_credentials': 'E-mail ou senha inválidos.',
    'auth.refresh_invalid': 'Sua sessão expirou. Entre novamente.',
    'auth.mfa_invalid': 'Código de verificação inválido.',
    'budget.target_already_claimed': 'Esta categoria já pertence a outro orçamento.',
    'goal.allocation_exceeds_100': 'Este investimento já tem {current, number}% alocado; adicionar {requested, number}% passaria de 100%.',
    'household.changed': 'Os membros desta casa mudaram enquanto você editava. Tente novamente.',
    'household.member_not_found': 'Esta pessoa não é membro da casa.',
    'holding.not_market_priced': 'Este investimento não usa valor de mercado manual.',
    'invitation.already_member': 'Usuário já é membro desta casa.',
    'invitation.already_pending': 'Usuário já tem um convite pendente.',
    'invitation.invitee_not_registered': 'Não há usuário cadastrado com este e-mail.',
    'invitation.not_found': 'Convite não encontrado.',
    'invitation.not_pending': 'Este convite não está mais pendente.',
    'notification.not_found': 'Notificação não encontrada.',
    'password.too_short': 'A senha precisa ter pelo menos {min, plural, one {# caractere} other {# caracteres}}.',
    'password_reset.token_invalid': 'Este link de redefinição é inválido ou expirou.',
    'report.unknown_type_or_range': 'Relatório desconhecido ou período inválido.',
    'session.not_found': 'Sessão não encontrada.',
    'snapshot.automatic_not_editable': 'Valores registrados automaticamente não podem ser editados.',
    'transaction.investment_not_allowed_on_account': 'Esta conta não aceita transações de investimento.',
  },
  fields: {
    'field.required': 'Campo obrigatório.',
    'field.invalid_type': 'Valor inválido.',
    'field.invalid_option': 'Escolha uma opção válida.',
    'field.invalid': 'Valor inválido.',
    'object.unknown_keys': 'Contém campos não reconhecidos.',
    'string.format': '{format, select, email {Informe um e-mail válido.} date {Informe uma data válida.} datetime {Informe uma data e hora válidas.} uuid {Identificador inválido.} other {Formato inválido.}}',
    'number.multiple_of': 'Deve ser múltiplo de {divisor, number}.',
    'number.min': 'Deve ser no mínimo {min, number}.',
    'number.max': 'Deve ser no máximo {max, number}.',
    'string.min': 'Use pelo menos {min, plural, one {# caractere} other {# caracteres}}.',
    'string.max': 'Use no máximo {max, plural, one {# caractere} other {# caracteres}}.',
    'array.min': 'Selecione pelo menos {min, plural, one {# item} other {# itens}}.',
    'array.max': 'Selecione no máximo {max, plural, one {# item} other {# itens}}.',
    'date.min': 'Data anterior ao permitido.',
    'date.max': 'Data posterior ao permitido.',
    'value.min': 'Valor abaixo do mínimo.',
    'value.max': 'Valor acima do máximo.',
  },
  notifications: {
    fallback: 'Você tem uma nova notificação.',
    'invitation.received': '{inviterName} convidou você para {householdName} como {role, select, Admin {administrador} Member {membro} Viewer {visualizador} other {membro}}.',
    'holding.matured': '{holdingName} venceu em {dueDate}.',
  } satisfies Record<NotificationKey, string>,
  emails: {
    'password.reset.subject': 'Redefinição de senha',
    'password.reset.body': 'Recebemos um pedido para redefinir a sua senha. Use o link abaixo em até {expiresInMinutes, plural, one {# minuto} other {# minutos}}:\n\n{resetLink}\n\nSe não foi você, ignore este e-mail; sua senha continua a mesma.',
  },
} as const;

export default ptBR;
