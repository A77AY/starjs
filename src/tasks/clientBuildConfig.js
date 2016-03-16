export default function getClientBuildConfig(config) {
    const {isDevelopment, rootPath} = config;
    const srcAbsPath = config.absPathFromRoot(config.structure.source.dirName);
    const cfgAbsPath = config.absPathFromRoot(config.structure.config);
    const pubAbsPath = config.absPathFromRoot(config.structure.public);
    const url = 'http://' + config.builder.client.watchServer.host + ':' + config.builder.client.watchServer.port;
    return {
        devtool: isDevelopment ? 'cheap-module-eval-source-map' : 'source-map',
        debug: isDevelopment,
        entry: {
            client: [
                'eventsource-polyfill', // for hot reloading with IE
                'webpack-dev-server/client?' + url,
                'webpack/hot/only-dev-server',
                path.join(path.relative(process.cwd(), srcAbsPath), 'client.js')
            ]
        },
        output: {
            path: pubAbsPath,
            publicPath: url + '/',
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
                    include: [srcAbsPath, cfgAbsPath, path.join(rootPath, 'node_modules', '_')]
                }, {
                    test: /\.json/,
                    loaders: ['json'],
                    exclude: /node_modules/
                }
            ]
        }
    };
}
