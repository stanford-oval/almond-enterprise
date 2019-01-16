// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

// FIXME we should not punch through the abstraction
require('thingengine-core/lib/polyfill');

process.on('unhandledRejection', (up) => { throw up; });

const express = require('express');
const http = require('http');
const path = require('path');
const logger = require('morgan');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const csurf = require('csurf');
const errorHandler = require('errorhandler');
const passport = require('passport');
const connect_flash = require('connect-flash');
const cacheable = require('cacheable-middleware');
const xmlBodyParser = require('express-xml-bodyparser');

const passportUtil = require('./util/passport');
const secretKey = require('./util/secret_key');
const db = require('./util/db');
const i18n = require('./util/i18n');
const userUtils = require('./util/user');
const platform = require('./util/platform');
const BackendClient = require('./backend/client');

const Config = require('./config');

class Frontend {
    constructor() {
        // all environments
        this._app = express();

        this.server = http.createServer(this._app);
        require('express-ws')(this._app, this.server);

        this._app.set('port', process.env.PORT || 8080);
        this._app.set('views', path.join(__dirname, 'views'));
        this._app.set('view engine', 'pug');
        this._app.enable('trust proxy');

        // work around a crash in expressWs if a WebSocket route fails with an error
        // code and express-session tries to save the session
        this._app.use((req, res, next) => {
            if (req.ws) {
                const originalWriteHead = res.writeHead;
                res.writeHead = function(statusCode) {
                    originalWriteHead.apply(this, arguments);
                    http.ServerResponse.prototype.writeHead.apply(this, arguments);
                };
            }

            next();
        });

        this._app.use(favicon(__dirname + '/public/images/favicon.ico'));

        this._app.use(logger('dev'));

        if (Config.ENABLE_SECURITY_HEADERS) {
            // security headers
            this._app.use((req, res, next) => {
                res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
                //res.set('Content-Security-Policy', `default-src 'self'; connect-src 'self' https://*.stanford.edu ; font-src 'self' https://maxcdn.bootstrapcdn.com https://fonts.googleapis.com ; img-src * ; script-src 'self' https://code.jquery.com https://maxcdn.bootstrapcdn.com 'unsafe-inline' ; style-src 'self' https://fonts.googleapis.com https://maxcdn.bootstrapcdn.com 'unsafe-inline'`);
                res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
                res.set('X-Frame-Options', 'DENY');
                res.set('X-Content-Type-Options', 'nosniff');
                next();
            });
        }

        this._app.use(bodyParser.json());
        this._app.use(bodyParser.urlencoded({ extended: true }));
        this._app.use(xmlBodyParser({ explicitArray: true, trim: false }));
        this._app.use(cookieParser());

        this._sessionStore = new MySQLStore({}, db.getPool());
        this._app.use(session({ resave: false,
                                saveUninitialized: false,
                                store: this._sessionStore,
                                secret: secretKey.getSecretKey(this._app) }));
        this._app.use(connect_flash());

        this._app.use(express.static(path.join(__dirname, 'public'),
                                     { maxAge: 86400000 }));
        this._app.use(cacheable());

        // development only
        if ('development' === this._app.get('env'))
            this._app.use(errorHandler());

        this._app.use(passport.initialize());
        this._app.use(passport.session());
        passportUtil.initialize();

        this._app.use((req, res, next) => {
            res.locals.user = req.user || { isConfigured: true };
            res.locals.authenticated = userUtils.isAuthenticated(req);

            // Capital C so we don't conflict with other parameters
            // set by various pages
            res.locals.Config = Config;
            res.locals.Constants = {
                Capability: userUtils.Capability,
                ProfileFlags: userUtils.ProfileFlags
            };
            next();
        });

        // i18n support
        const lang = i18n.get();
        this._app.use((req, res, next) => {
            req.locale = lang.locale;
            req.gettext = lang.gettext.bind(lang);
            req._ = req.gettext;
            req.pgettext = lang.pgettext.bind(lang);
            req.ngettext = lang.ngettext.bind(lang);

            res.locals.locale = lang.locale;
            res.locals.gettext = req.gettext;
            res.locals._ = req._;
            res.locals.pgettext = req.pgettext;
            res.locals.ngettext = req.ngettext;

            res.locals.timezone = process.env.TZ || 'America/Los_Angeles';
            next();
        });

        // mount /api before CSRF
        // as we don't need CSRF protection for that
        //this._app.use('/api/webhook', require('./routes/webhook'));
        this._app.use('/api/oauth2', require('./routes/oauth2'));
        this._app.use('/api', require('./routes/my_api'));

        this._app.use(csurf({ cookie: false }));
        this._app.use((req, res, next) => {
            res.locals.csrfToken = req.csrfToken();
            next();
        });

        this._app.use('/', require('./routes/about'));

        //this._app.use('/conversation', require('./routes/my_stuff'));
        //this._app.use('/devices', require('./routes/devices_compat'));

        //this._app.use('/profiles', require('./routes/thingpedia_profiles'));
        this._app.use('/user', require('./routes/user'));
        this._app.use('/admin', require('./routes/admin'));
        this._app.use('/admin/devices', require('./routes/devices'));

        this._app.use((req, res) => {
            // if we get here, we have a 404 response
            res.status(404).render('error', {
                page_title: req._("Almond - Page Not Found"),
                message: req._("The requested page does not exist")
            });
        });

        this._app.use((err, req, res, next) => {
            if (err.code === 'EBADCSRFTOKEN') {
                res.status(403).render('error', {
                    page_title: req._("Almond - Forbidden"),
                    message: err,

                    // make sure we have a csrf token in the page
                    // (this error could be raised before we hit the general code that sets it
                    // everywhere)
                    csrfToken: req.csrfToken()
                });
            } else if (err.errno === 'ENOENT') {
                // if we get here, we have a 404 response
                res.status(404).render('error', {
                    page_title: req._("Almond - Page Not Found"),
                    message: req._("The requested page does not exist")
                });
            } else {
                console.error(err);
                res.status(500).render('error', {
                    page_title: req._("Almond - Internal Server Error"),
                    message: req._("Code: %s").format(err.code || err.sqlState || err.errno || err.name)
                });
            }
        });

        this._websocketEndpoints = {};
    }

    async open() {
        // '::' means the same as 0.0.0.0 but for IPv6
        // without it, node.js will only listen on IPv4
        this._app.backend = new BackendClient();

        await new Promise((resolve, reject) => {
            this.server.listen(this._app.get('port'), '::', (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        await this._app.backend.start();

        console.log('Express server listening on port ' + this._app.get('port'));
    }

    async close() {
        // close the server asynchronously to avoid waiting on open
        // connections
        this.server.close((error) => {
            if (error) {
                console.log('Error stopping Express server: ' + error);
                console.log(error.stack);
            } else {
                console.log('Express server stopped');
            }
        });
        await this._sessionStore.close();
        await this._app.backend.stop();
        return Promise.resolve();
    }
}

function main() {
    platform.init();

    const frontend = new Frontend();
    function handleSignal() {
        frontend.close().then(() => {
            process.exit();
        });
    }
    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    // open the HTTP server
    return frontend.open();
}
main();
