var webpack = require('webpack');
var path = require('path');
var fs = require('fs');
var config = require('./app.server.js');

var nodeModules = fs.readdirSync(config.rootDir('node_modules'))
    .filter(function (x) {
        return ['.bin', '_'].indexOf(x) === -1;
    });

module.exports = {
    devtool: config.isDevelopment ? 'cheap-module-eval-source-map' : 'source-map',
    debug: config.isDevelopment,
    entry: {
        server: [
            'webpack/hot/signal.js',
            config.rootDir('src/server.js')
        ]
    },
    target: 'node',
    output: {
        path: config.rootPath('bin'),
        filename: '[name].js'
    },
    node: {
        __dirname: true,
        __filename: true
    },
    externals: [
        function (context, request, callback) {
            var pathStart = request.split('/')[0];
            if (nodeModules.indexOf(pathStart) >= 0 && request != 'webpack/hot/signal.js') return callback(null, "commonjs " + request);
            callback();
        }
    ],
    recordsPath: config.rootPath('bin/_records'),
    plugins: [
        new webpack.IgnorePlugin(/\.(css|sass|less|styl)$/),
        new webpack.BannerPlugin('require("source-map-support").install();',
            {
                raw: true,
                entryOnly: false
            }
        ),
        new webpack.HotModuleReplacementPlugin({quiet: true})
    ],
    module: {
        loaders: [
            {
                test: /\.jsx?/,
                loaders: ['monkey-hot', 'babel?presets[]=react,presets[]=es2015,presets[]=stage-0'],
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