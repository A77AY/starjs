var path = require('path');
var Log = require('./server/logger').default;

Log.Cl('run task');

process.argv.forEach((val, index, array) => {
    if (val === '--config' || val === '--cfg' || val === '-c') {
        process.argv[index] = '--configPath';
        process.argv[index + 1] = path.join(process.cwd(), process.argv[index + 1]);
        return process.argv.push('--gulpfile', path.join(__dirname, 'tasks/tasks.js'));
    } else if (val === '--gulpfile') return;
});

process.argv.push('--require', path.join(__dirname, 'tasks/transpiler.js'), '-L');
require('gulp/bin/gulp');