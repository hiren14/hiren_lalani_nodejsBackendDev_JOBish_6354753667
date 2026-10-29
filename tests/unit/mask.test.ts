import { maskEmail, maskPhone } from '../../src/utils/mask';

describe('mask', () => {
  it('masks phone numbers but keeps prefix and last 4 digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91******3210');
    expect(maskPhone('+919876543210')).not.toContain('98765');
  });
  it('masks emails', () => {
    expect(maskEmail('jane.doe@example.com')).toBe('j*******@example.com');
  });
});
