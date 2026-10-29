/** "+919876543210" -> "+91*******3210" (keeps country prefix + last 4 digits). */
export const maskPhone = (phone: string): string => {
  if (!phone) return '';
  if (phone.length <= 7) return '*'.repeat(phone.length);
  return `${phone.slice(0, 3)}${'*'.repeat(phone.length - 7)}${phone.slice(-4)}`;
};

/** "jane.doe@example.com" -> "j*******@example.com" */
export const maskEmail = (email: string): string => {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}${'*'.repeat(Math.max(at - 1, 3))}${email.slice(at)}`;
};
