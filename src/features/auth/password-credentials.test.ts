import { expect, test } from 'vitest';
import { passwordCredentials } from './password-credentials';
test('email credentials keep the password literal and omit phone', () => {
  expect(passwordCredentials(' buyer1@logstar.test ', ' pass word ')).toEqual({ email: 'buyer1@logstar.test', password: ' pass word ' });
});
test('phone credentials normalize international formatting and omit email', () => {
  expect(passwordCredentials('+84 (901) 234-567', 'secret')).toEqual({ phone: '+84901234567', password: 'secret' });
});
test.each(['', '0901234567', 'buyer@', 'a@@example.test', 'a b@example.test'])('invalid identifier %s is rejected before an SDK request', value => {
  expect(() => passwordCredentials(value, 'secret')).toThrow();
});
test('missing password is rejected for both identifier kinds', () => {
  expect(() => passwordCredentials('buyer1@logstar.test', '')).toThrow('mật khẩu');
  expect(() => passwordCredentials('+84901234567', '')).toThrow('mật khẩu');
});
