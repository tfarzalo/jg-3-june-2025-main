export type EmailTemplateMode = 'approval' | 'notification';

export function getEmailTemplateMode(templateType?: string | null): EmailTemplateMode {
  return templateType?.trim().toLowerCase() === 'approval' ? 'approval' : 'notification';
}

export function resolveEmailSendMode(
  notificationType: string,
  selectedTemplateType?: string | null,
): EmailTemplateMode {
  if (selectedTemplateType != null) return getEmailTemplateMode(selectedTemplateType);
  return notificationType === 'extra_charges' ? 'approval' : 'notification';
}
