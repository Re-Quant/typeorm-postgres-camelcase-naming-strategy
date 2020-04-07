import { TypeORMPostgresCamelCaseNamingStrategy } from './typeorm-postgres-camelcase-naming-strategy';

describe(`${ TypeORMPostgresCamelCaseNamingStrategy.name }`, () => {
  let strategy: TypeORMPostgresCamelCaseNamingStrategy;

  beforeEach(() => {
    strategy = new TypeORMPostgresCamelCaseNamingStrategy();
  });

  describe('.tableName()', () => {
    it('Should pluralize', () => {
      expect(strategy.tableName('User', undefined)).toBe('Users');
    });

    it('Should use pascal case', () => {
      expect(strategy.tableName('i_AM-aSuperUser', undefined)).toBe('IAmASuperUsers');
    });

    it('Should remove default \'Entity\' suffix', () => {
      expect(strategy.tableName('MySuperEntity', undefined)).toBe('MySupers');
    });

    it('Should remove custom suffix', () => {
      strategy = new TypeORMPostgresCamelCaseNamingStrategy('Model');
      expect(strategy.tableName('MySuperModel', undefined)).toBe('MySupers');
    });

    it('Should use custom name if it specified', () => {
      expect(strategy.tableName('User', 'Accounts')).toBe('Accounts');
    });
  });
});
