export default function getServerBuildConfig(config) {
    const {isDevelopment, rootPath} = config;
    const srcAbsPath = config.absPathFromRoot(config.structure.source.dirName);
    const cfgAbsPath = config.absPathFromRoot(config.structure.config);
    const binAbsPath = config.absPathFromRoot(config.structure.binary);
    const nodeModules = fs.readdirSync(path.join(rootPath, 'node_modules'))
        .filter((x) => {
            return ['.bin', '_'].indexOf(x) === -1;
        });
    return {
        devtool: isDevelopment ? 'cheap-module-eval-source-map' : 'source-map',
        debug: isDevelopment,
        entry: {
            server: [
                'webpack/hot/signal.js',
                path.join(path.relative(process.cwd(), srcAbsPath), 'server.js')
            ]
        },
        target: 'node',
        output: {
            path: binAbsPath,
            filename: '[name].js'
        },
        node: {
            __dirname: true,
            __filename: true
        },
        externals: [
            (context, request, callback) => {
                const pathStart = request.split('/')[0];
                if (nodeModules.indexOf(pathStart) >= 0 && request != 'webpack/hot/signal.js') return callback(null, "commonjs " + request);
                callback();
            }
        ],
        recordsPath: path.join(binAbsPath, '_records'),
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
                    include: [srcAbsPath, cfgAbsPath, path.join(rootPath, 'node_modules', '_')]
                }, {
                    test: /\.json/,
                    loaders: ['json'],
                    exclude: /node_modules/
                }
            ]
        }
    }
}