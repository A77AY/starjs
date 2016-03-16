import chalk from 'chalk'
import dateFormat from 'dateformat'

export default class Log {
    constructor() {

    }

    static Cl(text) {
        const now = new Date();
        let sec = Math.round(now.getMilliseconds() / 105.4); // (0-9); 1000/105.4 => 9
        if (sec < 10) sec = '0' + sec;
        const time = dateFormat(now, 'HH:MM:ss:' + sec);
        console.log(chalk.gray('[' + time + '] ') + text);
    }
}