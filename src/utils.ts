import * as __ from 'lodash/fp';

export const pascalCase = __.flow(__.camelCase, __.upperFirst);
