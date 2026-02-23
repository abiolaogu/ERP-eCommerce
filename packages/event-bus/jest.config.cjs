const { merge } = require('lodash');
const baseConfig = require('../../jest.preset.cjs');

const localConfig = {
  roots: ['<rootDir>/src'],
  displayName: 'event-bus',
  moduleNameMapper: {
    '^@fusioncommerce/(.*)$': '<rootDir>/../../packages/$1/src'
  },
  transform: {
    '^.+\\.(ts|tsx)?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json'
      }
    ]
  }
};

module.exports = merge({}, baseConfig, localConfig);