import path from 'path'
import fs from 'fs'
import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import nodemon from 'nodemon'
import del from 'del'
import gulp from 'gulp'
import chalk from 'chalk'

import Log from '../server/logger'

import getClientBuildConfig from './clientBuildConfig'
import getServerBuildConfig from './serverBuildConfig'

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
    getClientBuildConfig,
    getServerBuildConfig
}
