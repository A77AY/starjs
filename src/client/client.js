import React from 'react'
import { render } from 'react-dom'
import { Router, browserHistory } from 'react-router'

export default class Client {

    constructor(element) {
        this.element = element;
    }

    static Id(id) {
        return new Client(document.getElementById(id));
    }

    setRoutes(routes) {
        this.routes = routes;
    }

    render() {
        render(<Router history={browserHistory}>{this.routes}</Router>, this.element);
    }
}