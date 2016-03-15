import path from 'path'
import utils from './utils'
import {task, series, parallel} from 'gulp'

let cfg;

process.argv.forEach((val, index, array) => {
    if (val === '--configPath') {
        return cfg = require(process.argv[index + 1]).default;
    }
});

const serverBuildConfig = utils.getServerBuildConfig(cfg);
const clientBuildConfig = utils.getClientBuildConfig(cfg);

task('watch:server', utils.getWatchServerFc(serverBuildConfig));
task('build:server', utils.getBuildServerFc(serverBuildConfig));

task('watch:client', utils.getWatchClientFc(clientBuildConfig));
task('build:client', utils.getBuildClientFc(clientBuildConfig));

task('clear:server-build-dir', utils.getClearTmpFc(cfg));

task('build:index-generator', utils.getGenFc(cfg));
task('watch:index-generator', utils.getWatchGenFc(cfg));

task('build', series('build:index-generator', parallel('watch:index-generator', series('clear:server-build-dir', 'build:server'), 'build:client')));
task('watch', series(
    parallel('build:index-generator', 'clear:server-build-dir'),
    parallel('watch:server', 'watch:client', 'watch:index-generator'))
);

task('default', parallel('watch'));