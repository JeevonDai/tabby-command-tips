const path = require('path')

module.exports = {
  target: 'node',
  mode: 'development',
  devtool: 'source-map',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd',
    devtoolModuleFilenameTemplate: 'webpack-tabby-command-tips:///[resource-path]',
  },
  resolve: {
    extensions: ['.ts', '.js', '.pug', '.scss'],
    modules: [path.join(__dirname, '.'), path.join(__dirname, 'src'), 'node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{
          loader: 'ts-loader',
          options: { configFile: 'tsconfig.json' },
        }],
        exclude: /node_modules/,
      },
      {
        test: /\.pug$/,
        use: ['apply-loader', 'pug-loader'],
      },
      {
        test: /\.scss$/,
        use: ['to-string-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  externals: [
    'fs',
    'ngx-toastr',
    /^rxjs/,
    /^@angular/,
    /^@ng-bootstrap/,
    /^tabby-/,
  ],
}
