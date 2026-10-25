/**
 * Runtime self-check for profile pure helpers (no test-runner install).
 * From `frontend/`:
 *   node --experimental-strip-types app/lib/profile/__selfcheck__.mjs
 */
import { computeCompletion } from './completion.ts';
import { getInitials } from './initials.ts';
import { maskPhone } from './mask.ts';
import {
  validateBusinessName,
  validateDob,
  validateEmail,
  validateName,
  validatePhone,
} from './validation.ts';

let failed = 0;

function assert(cond, label) {
  if (cond) console.log(`  ok  ${label}`);
  else {
    failed += 1;
    console.error(` FAIL ${label}`);
  }
}

function assertEq(actual, expected, label) {
  const ok = Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log(`  ok  ${label}`);
  else {
    failed += 1;
    console.error(` FAIL ${label}\n       got: ${JSON.stringify(actual)}\n       exp: ${JSON.stringify(expected)}`);
  }
}

console.log('maskPhone');
assertEq(maskPhone('+91 9911050007'), '+91 99XXXXXX07', 'country + 10 digits');
assertEq(maskPhone('9911050007'), '99XXXXXX07', 'digits only');
assertEq(maskPhone(''), '—', 'empty');
assertEq(maskPhone('12'), '12', 'very short');
assertEq(maskPhone('+91'), '+91', 'country only');
assert(maskPhone('not-a-phone') === '—', 'garbage → dash');

console.log('getInitials');
assertEq(getInitials('Atharv Anand'), 'AA', 'latin two words');
assertEq(getInitials('  Atharv   Anand  '), 'AA', 'extra spaces');
assertEq(getInitials('अथर्व आनंद'), 'अआ', 'devanagari');
assertEq(getInitials(''), '?', 'empty');
assertEq(getInitials('😀😀'), '?', 'emoji only');
assertEq(getInitials('Single'), 'S', 'one word');

console.log('computeCompletion');
{
  const empty = computeCompletion(
    { hasName: false, hasPhone: false, hasAddress: false },
    null,
  );
  assertEq(empty.percent, 0, 'all missing → 0%');
  assert(empty.missingFields.includes('Full name'), 'missing name label');
  assert(empty.missingFields.includes('Phone'), 'missing phone label');

  const full = computeCompletion(
    { hasName: true, hasPhone: true, hasAddress: true },
    {
      email: 'a@b.co',
      photoDataUrl: 'data:image/jpeg;base64,xx',
      dob: '2000-01-01',
      gender: 'male',
      businessName: 'Shop',
      updatedAt: 1,
    },
  );
  assertEq(full.percent, 100, 'all present → 100%');
  assertEq(full.missingFields, [], 'no missing when full');

  const nameOnly = computeCompletion(
    { hasName: true, hasPhone: false, hasAddress: false },
    { updatedAt: 1 },
  );
  assertEq(nameOnly.percent, 20, 'name alone → 20%');
}

console.log('validation');
assertEq(validateName('A'), 'Name must be at least 2 characters.', 'name too short');
assertEq(validateName('Atharv Anand'), null, 'name ok');
assertEq(validateName('अथर्व'), null, 'hindi name ok');
assert(validateName('a'.repeat(61)) !== null, 'name too long');
assert(validateName('Bob123') !== null, 'name rejects digits');
assertEq(validateEmail(''), null, 'email optional');
assertEq(validateEmail('not-email'), 'Enter a valid email address.', 'email bad');
assertEq(validateEmail('a@b.co'), null, 'email ok');
assertEq(validatePhone(''), 'Enter a 10-digit Indian mobile number starting with 6–9.', 'phone empty');
assertEq(validatePhone('5911050007'), 'Enter a 10-digit Indian mobile number starting with 6–9.', 'phone bad start');
assertEq(validatePhone('9911050007'), null, 'phone ok');
assertEq(validateDob(''), null, 'dob optional');
assertEq(validateDob('2099-01-01'), 'Date of birth cannot be in the future.', 'dob future');
assertEq(validateDob('2020-01-01'), 'You must be at least 14 years old.', 'dob too young');
assertEq(validateDob('1990-06-15'), null, 'dob ok');
assertEq(validateBusinessName('x'.repeat(81)), 'Business name must be at most 80 characters.', 'biz long');
assertEq(validateBusinessName('My Shop'), null, 'biz ok');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll self-checks passed.');
