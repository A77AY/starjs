import express from 'express'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import {RouterContext, match} from 'react-router'

export default class Server {

    constructor(port, host) {
        this.port = port;
        this.host = host;
        this.app = new express();
    }

    setRoutes(routes, Template) {
        this.app.get('*', (req, res) => {
            match({routes, location: req.url}, (error, redirectLocation, renderProps) => {
                if (error) {
                    //res.status(500).send(error.message)
                    res.status(500).send('Internal server error')
                } else if (redirectLocation) {
                    res.redirect(302, redirectLocation.pathname + redirectLocation.search)
                } else if (renderProps) {
                    const doctype = '<!doctype html>';
                    const markup = ReactDOMServer.renderToString(<RouterContext {...renderProps}/>);
                    const template = ReactDOMServer.renderToStaticMarkup(<Template
                        title={renderProps.routes[1].component.title || renderProps.routes[0].component.title}
                        head={renderProps.routes[1].component.head || renderProps.routes[0].component.head}
                        markup={markup}/>
                    );
                    res.status(200).send(doctype + template);
                } else {
                    res.status(404).send('Not found')
                }
            })
        });
    }

    setPublic(publicDir) {
        this.app.use(express.static(publicDir));
    }

    run() {
        this.app.listen(this.port, this.host, () => {
            //console.log(`server run on http://${this.host}:${this.port}`);
        });
    }

}