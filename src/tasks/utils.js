import Log from '../server/logger'
import chalk from 'chalk'

const gulp = require('gulp');

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const nodemon = require('nodemon');
const del = require('del');

function onBuild(done) {
    return function (err, stats) {
        if (err) console.log('Error', err);
        else console.log(stats.toString());
        if (done) done();
    }
}

// CLIENT

function getBuildClientFc(clientConfig) {
    return (done) => {
        webpack(clientConfig).run(onBuild(done));
    }
}

function getWatchClientFc(clientConfig) {
    return (done) => {
        const webpackCompiler = webpack(clientConfig, (err, stats) => {
            if (err) return console.log(err);
            const jsonStats = stats.toJson();
            if (jsonStats.errors.length > 0) return console.log(jsonStats.errors);
            if (jsonStats.warnings.length > 0) return console.log(jsonStats.warnings);
            //console.log('client watch: run');
        });
        const webpackDevServer = new WebpackDevServer(webpackCompiler, {
            publicPath: clientConfig.output.publicPath,
            noInfo: true,
            hot: true,
            stats: {
                colors: true
            }
        });
        let url = clientConfig.output.publicPath.split('/')[2].split(':');
        const port = url[1];
        const host = url[0];
        webpackDevServer.listen(port, host, (err, result) => {
            if (err) console.log(err);
            Log.Cl(chalk.green('watch: client (run on ' + clientConfig.output.publicPath + ')'));
        });
    }
}

// SERVER

function getBuildServerFc(serverConfig) {
    return (done) => {
        webpack(serverConfig).run(onBuild(done));
    }
}

function getWatchServerFc(serverConfig) {
    return (done) => {
        let firstRun = true;
        let firedDone = false;
        webpack(serverConfig).watch(100, function (err, stats) {
            if (!firedDone) {
                firedDone = true;
                done();
            }
            if (firstRun) {
                firstRun = false;
                nodemon({
                    execMap: {
                        js: 'node'
                    },
                    script: path.join(serverConfig.output.path, 'server.js'),
                    ignore: ['*'],
                    watch: ['foo/'],
                    ext: 'noop'
                }).on('restart', function () {
                    Log.Cl('server patched');
                });
                Log.Cl(chalk.green('watch: server'));
            } else {
                nodemon.restart();
            }
        });
    }
}

// OTHER

function getClearDirFc(dirPath) {
    return (done) => {
        return del([path.join(dirPath, '*')], {force: true});
    }
}

function getClearTmpFc(config) {
    return gulp.parallel(
        getClearDirFc(path.join(config.rootPath, config.structure.binary)),
        (done) => {
            Log.Cl(chalk.yellow('clear binary directory'));
            done();
        }
    );
}

function collectFiles(pth, saveDir, file, files) {
    var filePath = path.relative(saveDir, file.path);
    if (filePath[0] !== '.') filePath = './' + filePath;
    var fileName = path.parse(file.path).name;
    var nameParts = path.relative(pth, file.path).split(path.sep);
    if (nameParts.length === 1) {
        if (files[fileName]) files[fileName].path = filePath.split(path.sep).join('/');
        else files[fileName] = {path: filePath.split(path.sep).join('/')};
    } else {
        var currentRoot = files;
        for (var i = 0; i < nameParts.length - 1; ++i) {
            if (i === nameParts.length - 2) {
                if (currentRoot[fileName]) currentRoot[fileName].path = filePath.split(path.sep).join('/');
                else currentRoot[fileName] = {path: filePath.split(path.sep).join('/')};
            } else {
                if (!currentRoot[nameParts[i]]) currentRoot[nameParts[i]] = {};
                if (!currentRoot[nameParts[i]].child) currentRoot[nameParts[i]].child = {};
                currentRoot = currentRoot[nameParts[i]].child;
            }
        }
    }
}

function indexGenerator(root) {
    var modules = '';
    for (var key in root) {
        if (root[key].child) modules += indexGenerator(root[key].child);
        if (root[key].path) modules += "export { default as " + key + " } from '" + root[key].path + "';\n";
    }
    return modules;
}

function importGenerator(root) {
    var modules = '';
    for (var key in root) {
        if (root[key].child) modules += importGenerator(root[key].child);
        if (root[key].path) modules += "import " + key + " from '" + root[key].path + "';\n";
    }
    return modules;
}

function routesGenerator(root) {
    var routes = '';
    var tagName = '';
    var pth = '';
    for (var key in root) {
        if (!root[key].path) continue;
        tagName = 'Route';
        pth = ' path=';
        switch (key) {
            case 'App':
                pth += '"/"';
                break;
            case 'Home':
                tagName = 'IndexRoute';
                pth = '';
                break;
            default:
                pth += '{' + key + '.path}';
        }
        routes += '\n<' + tagName + pth + ' component={' + key + '}' + (
                root[key].child
                    ? '>' + routesGenerator(root[key].child) + '\n</' + tagName
                    : '/'
            ) + '>';
    }
    return routes;
}

function createRoutes(saveDir, files) {
    var routesContent = "import React from 'react';\n";
    routesContent += "import {Route, IndexRoute} from 'react-router';\n";
    routesContent += importGenerator(files);
    routesContent += '\nexport default (' + routesGenerator(files) + '\n);';
    fs.writeFile(saveDir + '/routes.js', routesContent, function (err) {
        if (err)  return console.log(err);
    });
}

function getIndexGenFc(config, dirName) {
    let lastIndexContent = '';
    return (done) => {
        const pth = path.join(config.rootPath, config.structure.source.dirName, dirName);
        const dir = path.join(pth, '**/*.*');
        const saveDir = path.join(config.rootPath, 'node_modules/_', dirName);
        const files = {};
        return gulp.src(dir, {read: false})
            .on('error', console.log)
            .on('data', (file) => {
                collectFiles(pth, saveDir, file, files);
            })
            .on('end', () => {
                const indexContent = indexGenerator(files);
                if (indexContent !== lastIndexContent) {
                    lastIndexContent = indexContent;
                    fs.writeFile(saveDir + '/index.js', indexContent, function (err) {
                        if (err) return console.log(err);
                    });
                    Log.Cl('index for ' + dirName + ' updated');
                }
            });
    }
}

function getWatchIndexGenFc(config, dirName) {
    return (done) => {
        const pth = path.join(config.rootPath, config.structure.source.dirName, dirName);
        const dir = path.join(pth, '**/*.*');
        gulp.watch([dir], getIndexGenFc(config, dirName)).on('error', console.log);
    }
}

function getPagesIndexGenFc(config) {
    let lastIndexContent = '';
    return (done) => {
        const pth = path.join(config.rootPath, config.structure.source.dirName, config.structure.source.pages);
        const dir = path.join(pth, '**/*.*');
        const saveDir = path.join(config.rootPath, 'node_modules/_', config.structure.source.pages);
        const files = {};
        return gulp.src(dir, {read: false})
            .on('error', console.log)
            .on('data', (file) => {
                collectFiles(pth, saveDir, file, files);
            })
            .on('end', () => {
                // create index.js
                files.routes = {
                    path: './routes.js'
                };
                const indexContent = indexGenerator(files);
                if (lastIndexContent !== indexContent) {
                    lastIndexContent = indexContent;
                    fs.writeFile(saveDir + '/index.js', indexContent, function (err) {
                        if (err)  return console.log(err);
                    });
                    // create routes.js
                    const routesFiles = {
                        App: files.App
                    };
                    delete files.routes;
                    delete files.Template;
                    delete files.App;
                    routesFiles.App.child = files;
                    createRoutes(saveDir, routesFiles);
                    Log.Cl('index and routes for pages updated');
                }
            });
    }
}

function getWatchPagesIndexGenFc(config) {
    return (done) => {
        const pth = path.join(config.rootPath, config.structure.source.dirName, config.structure.source.pages);
        const dir = path.join(pth, '**/*.*');
        gulp.watch([dir], getPagesIndexGenFc(config)).on('error', console.log);
    }
}

function createDir(dirPath) {
    try {
        fs.lstatSync(rootPath).isDirectory();
        return true;
    } catch (e) {
        try {
            fs.mkdirSync(dirPath);
        } catch (e) {
            if (e.code != 'EEXIST') throw e;
        }
        return false;
    }
}

function getGenFc(config) {
    const rootPath = path.join(config.rootPath, 'node_modules/_');
    createDir(rootPath);
    createDir(path.join(rootPath, config.structure.source.pages));
    createDir(path.join(rootPath, config.structure.source.components));
    createDir(path.join(rootPath, config.structure.source.utils));
    return gulp.parallel(
        getIndexGenFc(config, config.structure.source.components),
        getIndexGenFc(config, config.structure.source.utils),
        getPagesIndexGenFc(config),
        (done) => {
            Log.Cl(chalk.yellow('generate routes for pages, index for pages, components, utils'));
            done();
        }
    );
}

function getWatchGenFc(config) {
    return gulp.parallel(
        getWatchIndexGenFc(config, config.structure.source.components),
        getWatchIndexGenFc(config, config.structure.source.utils),
        getWatchPagesIndexGenFc(config),
        (done) => {
            Log.Cl(chalk.green('watch: generate routes for pages, index for pages, components, utils'));
            done();
        }
    );
}

// CONFIGS

function getServerBuildConfig(config) {
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

function getClientBuildConfig(config) {
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

export default{
    getBuildClientFc,
    getWatchClientFc,
    getBuildServerFc,
    getWatchServerFc,
    getClearDirFc,
    getClearTmpFc,
    getIndexGenFc,
    getWatchIndexGenFc,
    getPagesIndexGenFc,
    getWatchPagesIndexGenFc,
    getGenFc,
    getWatchGenFc,
    getServerBuildConfig,
    getClientBuildConfig
}