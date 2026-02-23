const { merge } = require('lodash');
const baseConfig = require('../../jest.preset.cjs');

const localConfig = {
  roots: ['<rootDir>/src'],
  displayName: 'catalog-service',
  moduleNameMapper: {
    '^@fusioncommerce/(.*)$': '<rootDir>/../../packages/$1/src'
  }
};

module.exports = merge({}, baseConfig, localConfig);
