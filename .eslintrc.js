const errorInProduction = process.env.NODE_ENV === 'production' ? 'error' : 'off';
const path = require('path');

module.exports = {
  root: true,
  env: {
    node: true,
    browser: true
  },
  extends: [
  ],
  rules: {
    'no-console': 0, // errorInProduction,
    'no-debugger': errorInProduction,
    'brace-style': 0,
    // 'brace-style': [2, 'stroustrup'],
    'padded-blocks': 0,
    // 'indent': [2, 2, { 'SwitchCase': 1 }],
    'indent': 0,
    'spaced-comment': 0,
    'quotes': 0,
    // 'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'global-require': 0,
    'no-unused-vars': [0, { 'argsIgnorePattern': '^_' }],
    'quote-props': [0],
    'prefer-destructuring': 0,
    'prefer-arrow-callback': 0,
    'prefer-template': 0,
    'comma-dangle': 0,
    'max-len': 0,
    'no-param-reassign': 0,
    'no-underscore-dangle': 0,
  },
};

