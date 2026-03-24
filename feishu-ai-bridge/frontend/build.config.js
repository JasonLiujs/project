const path = require('path');

module.exports = {
  entry: {
    main: './src/index.js',
  },
  output: {
    filename: 'js/[name].[contenthash:8].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    clean: true,
  },
};
