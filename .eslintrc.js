module.exports = {
  'env': {
    'browser': true
  },
  'globals': {
    'define': false,
    'require': false,
    'chroma': false,
    'anime': false,
    'Dragdealer': false
  },
  'extends': 'eslint:recommended',
  'parserOptions': {
    'ecmaVersion': 5
  },
  'rules': {
    'no-console': ['error', {
      allow: ['warn', 'error']
    }],
    'indent': ['error', 2],
    'linebreak-style': ['error', 'windows'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always']
  }
};
