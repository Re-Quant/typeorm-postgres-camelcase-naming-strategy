import { pascalCase } from './utils';

describe('Utils', () => {
  describe('.pascalCase()', () => {
    it('Should transform string from any case to the pascal case', () => {
      const expected = 'MySuperClass';
      const sources = [
        'MySuperClass',
        'my-super-class',
        'my super class',
        'my_super_class',
        'my Super_Class',
      ];
      sources.forEach(variant => expect(pascalCase(variant)).toBe(expected));
    });
  });
});
