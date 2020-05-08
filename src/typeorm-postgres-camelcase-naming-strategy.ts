import { DefaultNamingStrategy, getMetadataArgsStorage, Table, TableIndex } from 'typeorm';
import { IndexMetadataArgs } from 'typeorm/metadata-args/IndexMetadataArgs';
import { TableMetadataArgs } from 'typeorm/metadata-args/TableMetadataArgs';
import { RandomGenerator } from 'typeorm/util/RandomGenerator';

import * as pluralize from 'pluralize';
import * as _ from 'lodash';
import * as __ from 'lodash/fp';

import { pascalCase } from './utils';

interface IndexInfo {
  isUnique: boolean;
}

const PG_NAMEDATALEN = 63;
const HASH_LEN = 8;

interface CustomConfig {
  /** Suffix that should be omitted in the DB table name */
  entitySuffix?: string | string[];
  /** Not pluralized suffix */
  inDbSuffix?: string | string[];
}

interface ConfigInternal {
  entitySuffixes: string[];
  inDbSuffixes: string[];
}

const defaultConfig: CustomConfig = {
  entitySuffix: 'Entity',
  inDbSuffix: 'Zip',
};

// TODO: 1. implement column transformation
// TODO: 2. add unit tests
// TODO: 1. implement enum transformation
export class TypeORMPostgresCamelCaseNamingStrategy extends DefaultNamingStrategy {
  private entitiesByTableName: { [tableName: string]: TableMetadataArgs } = {};

  private readonly config: ConfigInternal;

  public constructor(
    customConfig: CustomConfig = {},
  ) {
    super();
    const config = { ...defaultConfig, ..._.omitBy(customConfig, __.isEmpty) };

    this.config = {
      entitySuffixes:     _.castArray(config.entitySuffix),
      inDbSuffixes: _.castArray(config.inDbSuffix),
    };
  }

  public tableName(targetName: string, userSpecifiedName: string | undefined): string {
    if (userSpecifiedName) return userSpecifiedName;

    const entitySuffix = this.config.entitySuffixes.find(suffix => targetName.endsWith(suffix));
    const targetNameWithoutEntitySuffix = entitySuffix
                                    ? targetName.slice(0, entitySuffix.length * -1)
                                    : targetName;

    const inDbSuffix = this.config.inDbSuffixes.find(suffix => targetNameWithoutEntitySuffix.endsWith(suffix));
    const targetNameWithoutInDbSuffix = inDbSuffix
                                    ? targetNameWithoutEntitySuffix.slice(0, inDbSuffix.length * -1)
                                    : targetNameWithoutEntitySuffix;

    const transformedName = pascalCase(pluralize.plural(targetNameWithoutInDbSuffix));
    return inDbSuffix ? transformedName + inDbSuffix : transformedName;
  }

  public primaryKeyName(tableOrName: Table|string, columnNames: string[]): string {
    const { columns, tableName } = this.prepareTableNameAndColumns(tableOrName, columnNames);

    const name = `PK_${ tableName }_${ this.joinCols(columns) }`;

    return this.preparePgName(name, name);
  }

  public uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    const { columns, tableName } = this.prepareTableNameAndColumns(tableOrName, columnNames);

    const name = `UQ_${ tableName }_${ this.joinCols(columns) }`;

    return this.preparePgName(name, name);
  }

  public relationConstraintName(tableOrName: Table | string, columnNames: string[], where?: string): string {
    const { columns, tableName } = this.prepareTableNameAndColumns(tableOrName, columnNames);

    const name = `REL_${ tableName }_${ this.joinCols(columns) }`;

    let hashKey = name;
    if (where) hashKey += `_${ where }`;

    return this.preparePgName(name, hashKey);
  }

  public defaultConstraintName(tableOrName: Table | string, columnName: string): string {
    const tableName = this.prepareTableName(tableOrName);

    const name = `DF_${ tableName }_${ columnName }`;

    return this.preparePgName(name, name);
  }

  public foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
    _referencedTablePath?: string,
    _referencedColumnNames?: string[],
  ): string {
    const { columns, tableName } = this.prepareTableNameAndColumns(tableOrName, columnNames);
    const { columns: targetColumns, tableName: targetTableName }
        = this.prepareTableNameAndColumns(_referencedTablePath || '', _referencedColumnNames || []);

    const name = `FK_${ tableName }_${ targetTableName }_${ this.joinCols(columns) }_${ this.joinCols(targetColumns) }`;

    return this.preparePgName(name, name);
  }

  public indexName(tableOrName: Table | string, columnNames: string[], where?: string): string {
    const { columns, tableName } = this.prepareTableNameAndColumns(tableOrName, columnNames);

    const { isUnique } = this.getIndexInfo(tableOrName, columnNames, where);
    const prefix = isUnique ? 'UQIDX' : 'IDX';
    const name = `${ prefix }_${ tableName }_${ this.joinCols(columns) }`;

    let hashKey = name;
    if (where) hashKey += `_${ where }`;

    return this.preparePgName(name, hashKey);
  }

  public checkConstraintName(tableOrName: Table | string, expression: string): string {
    const tableName = this.prepareTableName(tableOrName);

    const hashKey = `${ tableName }_${ expression }`;
    const name = `CHK_${ tableName }`;

    return this.preparePgName(name, hashKey);
  }

  public exclusionConstraintName(tableOrName: Table | string, expression: string): string {
    const tableName = this.prepareTableName(tableOrName);

    const hashKey = `${ tableName }_${ expression }`;
    const name = `XCL_${ tableName }`;

    return this.preparePgName(name, hashKey);
  }

  /**
   * 1. Trims incoming string by 63 bytes (max PostgreSQL identifier length), if it too long
   * 2. Appends incoming string with hash to make length equal 63 bytes
   */
  public preparePgName(name: string, keyToHashing: string): string {
    const lodashLen = 1;

    const hash = RandomGenerator.sha1(keyToHashing).slice(0, 8);
    const trimmed = Buffer.from(name).slice(0, PG_NAMEDATALEN - HASH_LEN - lodashLen).toString();

    return `${ trimmed }_${ hash }`;
  }

  public joinCols(columnNames: string[]): string {
    return columnNames.join(',');
  }

  private initEntitiesByTableName(): IndexMetadataArgs | void {
    if (_.some(this.entitiesByTableName)) return;

    this.entitiesByTableName = __.flow(
      __.filter((table: TableMetadataArgs): boolean => {
        if (!_.isFunction(table.target)) {
          this.warn('The table doesn\'t have a target Class. Omitted.', table);
          return false;
        }
        if (!table.target.name && !table.name) {
          this.warn('The table doesn\'t have name. Omitted.', table);
          return false;
        }

        return true;
      }),
      __.keyBy((table: TableMetadataArgs) => this.tableName((table.target as Function).name, table.name)),
    )(getMetadataArgsStorage().tables);
  }

  private getIndexInfo(tableOrName: Table | string, columnNames: string[], where?: string): IndexInfo {
    if (tableOrName instanceof Table) {
      return __.flow(
        __.find((index: TableIndex) => _.isEqual(index.columnNames, columnNames) && index.where === where),
        __.tap((info?: IndexInfo) => !info
            && this.warn('Can\'t find index.\nTable: %O\nColums: %O\nWhere: \'%s\'', tableOrName, columnNames, where),
        ),
        __.thru((index?: TableIndex): IndexInfo => ({ isUnique: !!index?.isUnique })),
      )(tableOrName.indices);
    }
    this.initEntitiesByTableName();

    const tableMetadata = this.entitiesByTableName[tableOrName];
    if (!tableMetadata) {
      this.warn('Can\'t find table by name in the metadata args storage. Name:', tableOrName);
    }
    return __.flow(
      __.find((index: IndexMetadataArgs) => index.target === tableMetadata.target
                                                  && _.isEqual(index.columns, columnNames)
                                                  && index.where === where,
      ),
      __.tap((info?: IndexInfo) => !info
        && this.warn('Can\'t find index.\nTableName: %O\nColums: %O\nWhere: \'%s\'', tableOrName, columnNames, where),
      ),
      __.thru((index?: IndexMetadataArgs): IndexInfo => ({ isUnique: !!index?.unique })),
    )(getMetadataArgsStorage().indices);
  }

  private prepareTableNameAndColumns(
    tableOrName: Table | string,
    columnNames: string[],
  ): { tableName: string; columns: string[] } {
    return {
      tableName: this.prepareTableName(tableOrName),
      columns: this.prepareColumns(columnNames),
    };
  }

  /**
   * This is a single place where we can prepare columns for all naming functions.
   */
  private prepareColumns(columnNames: string[]): string[] {
    return columnNames;
  }

  private prepareTableName(tableOrName: Table | string): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    return replacedTableName;
  }

  private warn(...args: any[]): void {
    const localArgs = [...args];
    const first: string = _.isString(localArgs[0]) ? `%s${ localArgs.shift() }` : '%s';
    // eslint-disable-next-line no-console
    console.warn(first, `Warning! [${ this.constructor.name }]: `, ...localArgs);
  }

}
