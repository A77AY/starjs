var webpack = require('webpack');
var path = require('path');
var config = require('./app.server.js');

module.exports = {
    devtool: config.isDevelopment ? 'cheap-module-eval-source-map' : 'source-map',
    debug: config.isDevelopment,
    entry: {
        client: [
            'eventsource-polyfill', // for hot reloading with IE
            'webpack-dev-server/client?http://localhost:5001',
            'webpack/hot/only-dev-server',
            config.rootDir('src/client.js')
        ]
    },
    output: {
        path: config.rootPath('public'),
        publicPath: 'http://localhost:5001/',
        filename: '[name].js'
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoErrorsPlugin()
    ],
    module: {
        loaders: [
            {
                test: /\.jsx?/,
                loaders: ['babel?presets[]=react,presets[]=es2015,presets[]=stage-0,presets[]=react-hmre'],
                //exclude: /node_modules/,
                include: [config.rootPath('src'), config.rootPath('node_modules/_')]
            }, {
                test: /\.json/,
                loaders: ['json'],
                exclude: /node_modules/
            }
        ]
    }
};
