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

    it('Should use custom name if it specified', () => {
      expect(strategy.tableName('User', 'Accounts')).toBe('Accounts');
    });

    describe('.entitySuffix option', () => {

      it('Should remove default \'Entity\' suffix', () => {
        expect(strategy.tableName('MySuperEntity', undefined)).toBe('MySupers');
      });

      it('Should remove custom suffix', () => {
        strategy = new TypeORMPostgresCamelCaseNamingStrategy({ entitySuffix: 'Model' });
        expect(strategy.tableName('MySuperEntity', undefined)).toBe('MySuperEntities');
        expect(strategy.tableName('MySuperModel', undefined)).toBe('MySupers');
      });

      it('Should remove multiple custom suffix', () => {
        strategy = new TypeORMPostgresCamelCaseNamingStrategy({ entitySuffix: ['Entity', 'Model'] });
        expect(strategy.tableName('MySuperEntity', undefined)).toBe('MySupers');
        expect(strategy.tableName('MySuperModel', undefined)).toBe('MySupers');
      });

    });

    describe('.inDbSuffix option', () => {

      it('Should preserve default \'Zip\' in-db-suffix', () => {
        expect(strategy.tableName('UserZip', undefined)).toBe('UsersZip');
      });

      it('Should preserve custom in-db-suffix and pluralize name before it', () => {
        strategy = new TypeORMPostgresCamelCaseNamingStrategy({ inDbSuffix: 'Pack' });
        expect(strategy.tableName('UserZip', undefined)).toBe('UserZips');
        expect(strategy.tableName('UserPack', undefined)).toBe('UsersPack');
      });

      it('Should preserve multiple custom in-db-suffixes and pluralize name before it', () => {
        strategy = new TypeORMPostgresCamelCaseNamingStrategy({ inDbSuffix: ['Zip', 'Pack'] });
        expect(strategy.tableName('UserZip', undefined)).toBe('UsersZip');
        expect(strategy.tableName('UserPack', undefined)).toBe('UsersPack');
      });

    });
  });
});
