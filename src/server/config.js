import path from 'path'

export default class Config {
    constructor(config) {
        this.init();
        this.setConfig(this, this.defaultConfig);
        this.setConfig(this, config);
        if (config[this.env]) this.setConfig(config[this.env]);
    }

    init() {
        this.env = process.env.NODE_ENV;
        this.isDevelopment = this.env === 'development';
        this.isProduction = this.env === 'production';
    }

    setConfig(toConfig, fromConfig){
        for (let key in fromConfig) {
            if(
                typeof fromConfig[key] === 'object'
                && Object.keys(fromConfig[key]).length > 0
                && toConfig[key]
                && typeof toConfig[key] === 'object'
                && Object.keys(toConfig[key]).length > 0
            ) {
                this.setConfig(toConfig[key], fromConfig[key])
            } else toConfig[key] = fromConfig[key];
        }
    }

    defaultConfig = {
        server: {
            host: 'localhost',
            port: 8080
        },
        builder: {
            client: {
                watchServer: {
                    host: 'localhost',
                    port: 4040
                }
            }
        },
        structure: {
            server: {
                fileName: 'server.js'
            },
            client: {
                fileName: 'client.js'
            },
            source: {
                dirName: 'src',
                pages: 'pages',
                components: 'components',
                utils: 'utils'
            },
            binary: 'bin',
            public: 'pub',
            config: 'cfg'
        }
    };

    pathFromRoot(toPath) {
        return path.relative(this.rootPath, path.join(this.rootPath, toPath));
    }

    absPathFromRoot(toPath) {
        return path.join(this.rootPath, toPath);
    }
}