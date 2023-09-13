const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (options, webpack) => {
  const lazyImports = [
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
  ];

  return {
    ...options,
    externals: {
      '@sentry/profiling-node': 'commonjs @sentry/profiling-node',
    },
    devtool: 'source-map',
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            keep_classnames: true,
          },
        }),
      ],
    },
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (lazyImports.includes(resource)) {
            try {
              require.resolve(resource);
            } catch (err) {
              return true;
            }
          }
          return false;
        },
      }),
      sentryWebpackPlugin({
        org: process.env.SENTRY_ORG,
        project: 'api',
        authToken: process.env.SENTRY_AUTH_TOKEN,
      }),
    ],
  };
};
