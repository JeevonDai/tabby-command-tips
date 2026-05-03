const path = require('path')

module.exports = {
  target: 'electron-renderer',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js', '.pug', '.scss'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.pug$/,
        use: ['apply-loader', 'pug-loader'],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  externals: {
    'tabby-core': 'tabby-core',
    'tabby-settings': 'tabby-settings',
    'tabby-terminal': 'tabby-terminal',
  },
}
