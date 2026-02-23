const { merge } = require('lodash');
const baseConfig = require('../../jest.preset.cjs');

const localConfig = {
  roots: ['<rootDir>/src'],
  displayName: 'group-commerce-service',
  moduleNameMapper: {
    '^@fusioncommerce/(.*)$': '<rootDir>/../../packages/$1/src'
  }
};

module.exports = merge({}, baseConfig, localConfig);