const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack');

// Get NODE_ENV from environment variable (set by nx configuration)
const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/api'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: nodeEnv === 'production',
      outputHashing: 'none',
      generatePackageJson: true,
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    }),
  ],
  externals: {
    // Keep process.env available at runtime
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
