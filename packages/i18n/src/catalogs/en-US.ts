import type { Catalog } from '../catalog';

/** en-US catalog. Typed as `Catalog`, so a missing or extra key fails typecheck. */
const enUS: Catalog = {
  errors: {
    fallback: 'Something went wrong.',
    'validation.failed': 'Some fields need your attention.',
    'request.invalid': 'The request could not be processed.',
    'route.not_found': 'Not found.',
    'internal.unexpected': 'Something went wrong. Please try again.',
    'auth.forbidden': "You don't have permission to do that.",
    'auth.invalid_credentials': 'Invalid email or password.',
    'auth.refresh_invalid': 'Your session has expired. Please sign in again.',
    'auth.mfa_invalid': 'Invalid verification code.',
    'budget.target_already_claimed': 'This category already belongs to another budget.',
    'goal.allocation_exceeds_100': 'This holding already has {current, number}% allocated; adding {requested, number}% would exceed 100%.',
    'holding.not_market_priced': "This holding doesn't use a manual market value.",
    'invitation.invitee_not_registered': 'No registered user has this email.',
    'invitation.not_pending': 'This invitation is no longer pending.',
    'notification.not_found': 'Notification not found.',
    'password.too_short': 'Password must be at least {min, plural, one {# character} other {# characters}}.',
    'password_reset.token_invalid': 'This reset link is invalid or has expired.',
    'report.unknown_type_or_range': 'Unknown report or invalid period.',
    'session.not_found': 'Session not found.',
    'snapshot.automatic_not_editable': "Automatically recorded values can't be edited.",
    'transaction.investment_not_allowed_on_account': "This account doesn't accept investment transactions.",
  },
  fields: {
    'field.required': 'Required.',
    'field.invalid_type': 'Invalid value.',
    'field.invalid_option': 'Choose a valid option.',
    'field.invalid': 'Invalid value.',
    'object.unknown_keys': 'Contains unrecognized fields.',
    'string.format': '{format, select, email {Enter a valid email.} date {Enter a valid date.} datetime {Enter a valid date and time.} uuid {Invalid identifier.} other {Invalid format.}}',
    'number.multiple_of': 'Must be a multiple of {divisor, number}.',
    'number.min': 'Must be at least {min, number}.',
    'number.max': 'Must be at most {max, number}.',
    'string.min': 'Use at least {min, plural, one {# character} other {# characters}}.',
    'string.max': 'Use at most {max, plural, one {# character} other {# characters}}.',
    'array.min': 'Select at least {min, plural, one {# item} other {# items}}.',
    'array.max': 'Select at most {max, plural, one {# item} other {# items}}.',
    'date.min': 'Date is earlier than allowed.',
    'date.max': 'Date is later than allowed.',
    'value.min': 'Value is below the minimum.',
    'value.max': 'Value is above the maximum.',
  },
  notifications: {
    fallback: 'You have a new notification.',
    'invitation.received': '{inviterName} invited you to {householdName} as {role, select, Admin {an admin} Member {a member} Viewer {a viewer} other {a member}}.',
    'holding.matured': '{holdingName} matured on {dueDate}.',
  },
  emails: {
    'password.reset.subject': 'Reset your password',
    'password.reset.body': "We received a request to reset your password. Use the link below within {expiresInMinutes, plural, one {# minute} other {# minutes}}:\n\n{resetLink}\n\nIf this wasn't you, ignore this email; your password stays the same.",
  },
};

export default enUS;
