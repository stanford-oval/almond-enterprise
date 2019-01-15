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

const express = require('express');
const crypto = require('crypto');
const passport = require('passport');

const Config = require('../config');

const user = require('../util/user');

function makeRandom(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
}

var router = express.Router();

const ALLOWED_ORIGINS = [Config.SERVER_ORIGIN, ...Config.EXTRA_ORIGINS, 'null'];

function isOriginOk(req) {
    if (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer '))
        return true;
    if (typeof req.headers['origin'] !== 'string')
        return false;
    return ALLOWED_ORIGINS.indexOf(req.headers['origin'].toLowerCase()) >= 0;
}

router.use((req, res, next) => {
    if (isOriginOk(req)) {
        if (req.headers['origin']) {
            res.set('Access-Control-Allow-Origin', req.headers['origin']);
            res.set('Vary', 'Origin');
        }
        res.set('Access-Control-Allow-Credentials', 'true');
        next();
    } else {
        res.status(403).send('Forbidden Cross Origin Request');
    }
});

router.use((req, res, next) => {
    if (req.user) {
        next();
        return;
    }
    passport.authenticate('bearer', { session: false })(req, res, next);
});

router.options('/.*', (req, res, next) => {
    res.send('');
});

/*
router.get('/parse', user.requireScope('user-read'), (req, res, next) => {
    let query = req.query.q || null;
    let targetJson = req.query.target_json || null;
    if (!query && !targetJson) {
        res.status(400).json({error:'Missing query'});
        return;
    }

    Q.try(() => {
        return EngineManager.get().getEngine(req.user.id);
    }).then((engine) => {
        return engine.assistant.parse(query, targetJson);
    }).then((result) => {
        res.json(result);
    }).catch((e) => {
        console.error(e.stack);
        res.status(500).json({error:e.message});
    });
});
*/

router.post('/apps/create', user.requireScope('user-exec-command'), (req, res, next) => {
    Promise.resolve().then(async () => {
        const backend = req.app.backend;
        const result = await backend.assistant.createApp(req.body);
        if (result.error)
            res.status(400);
        res.json(result);
    }).catch(next);
});

router.get('/apps/list', user.requireScope('user-read'), (req, res, next) => {
    Promise.resolve().then(async () => {
        const backend = req.app.backend;
        res.json(await backend.getAllApps());
    }).catch(next);
});

router.get('/apps/get/:appId', user.requireScope('user-read'), (req, res, next) => {
    Promise.resolve().then(async () => {
        const backend = req.app.backend;
        const app = await backend.getApp(req.params.appId);
        if (!app) {
            res.status(404);
            res.json({ error: 'No such app' });
        } else {
            res.json(app);
        }
    }).catch(next);
});

router.post('/apps/delete/:appId', user.requireScope('user-exec-command'), (req, res, next) => {
    Promise.resolve().then(async () => {
        const backend = req.app.backend;
        const ok = await backend.deleteApp(req.params.appId);
        if (!ok) {
            res.status(404);
            res.json({ error: 'No such app' });
        } else {
            res.json({ result: 'ok' });
        }
    }).catch(next);
});

class WebsocketApiDelegate {
    constructor(ws) {
        this._ws = ws;
    }

    send(str) {
        try {
            this._ws.send(str);
        } catch(e) {
            // ignore if the socket is closed
            if (e.message !== 'not opened')
                throw e;
        }
    }
}
WebsocketApiDelegate.prototype.$rpcMethods = ['send'];

router.ws('/results', user.requireScope('user-read-results'), (ws, req, next) => {
    Promise.resolve().then(() => {
        const backend = req.app.backend;

        let delegate = new WebsocketApiDelegate(ws);
        ws.on('error', (err) => {
            ws.close();
        });
        ws.on('close', async () => {
            try {
                await backend.assistant.removeOutput(delegate);
            } catch(e) {
                // ignore errors if engine died
            }
            delegate.$free();
        });
        ws.on('ping', (data) => ws.pong(data));

        return backend.assistant.addOutput(delegate);
    }).catch((error) => {
        console.error('Error in API websocket: ' + error.message);
        ws.close();
    });
});

class WebsocketAssistantDelegate {
    constructor(ws) {
        this._ws = ws;
    }

    send(text, icon) {
        return this._ws.send(JSON.stringify({ type: 'text', text: text, icon: icon }));
    }

    sendPicture(url, icon) {
        return this._ws.send(JSON.stringify({ type: 'picture', url: url, icon: icon }));
    }

    sendRDL(rdl, icon) {
        return this._ws.send(JSON.stringify({ type: 'rdl', rdl: rdl, icon: icon }));
    }

    sendChoice(idx, what, title, text) {
        return this._ws.send(JSON.stringify({ type: 'choice', idx: idx, title: title, text: text }));
    }

    sendButton(title, json) {
        return this._ws.send(JSON.stringify({ type: 'button', title: title, json: json }));
    }

    sendLink(title, url) {
        return this._ws.send(JSON.stringify({ type: 'link', title: title, url: url }));
    }

    sendAskSpecial(what) {
        return this._ws.send(JSON.stringify({ type: 'askSpecial', ask: what }));
    }
}
WebsocketAssistantDelegate.prototype.$rpcMethods = ['send', 'sendPicture', 'sendChoice', 'sendLink', 'sendButton', 'sendAskSpecial', 'sendRDL'];

async function doConversation(user, ws, req) {
    try {
        const backend = req.app.backend;
        const delegate = new WebsocketAssistantDelegate(ws);

        let opened = false, earlyClose = false;
        const id = 'enterprise:' + req.user.cloud_id + ':' + makeRandom(4);
        ws.on('error', (err) => {
            ws.close();
        });
        ws.on('close', async () => {
            try {
                if (opened)
                    await backend.assistant.closeConversation(id);
            } catch(e) {
                // ignore errors if engine died
            }
            earlyClose = true;
            opened = false;
            if (delegate.$free)
                delegate.$free();
        });

        const options = { showWelcome: true };
        const conversation = await backend.assistant.openConversation(id, req.user, delegate, options);
        opened = true;
        ws.on('message', (data) => {
            Promise.resolve().then(() => {
                var parsed = JSON.parse(data);
                switch(parsed.type) {
                case 'command':
                    return conversation.handleCommand(parsed.text);
                case 'parsed':
                    return conversation.handleParsedCommand(parsed.json);
                case 'tt':
                    return conversation.handleThingTalk(parsed.code);
                default:
                    throw new Error('Invalid command type ' + parsed.type);
                }
            }).catch((e) => {
                console.error(e.stack);
                ws.send(JSON.stringify({ type: 'error', error:e.message }));
            }).catch((e) => {
                // likely, the websocket is busted
                console.error(`Failed to send error on conversation websocket: ${e.message}`);

                // ignore "Not Opened" error in closing
                try {
                    ws.close();
                } catch(e) {/**/}
            });
        });
        if (earlyClose)
            return;
        await conversation.start();
    } catch(error) {
        console.error('Error in conversation websocket: ' + error.message);

        // ignore "Not Opened" error in closing
        try {
            ws.close();
        } catch(e) {/**/}
    }
}

router.ws('/conversation', user.requireScope('user-exec-command'), (ws, req, next) => {
    doConversation(req.user, ws, req);
});

module.exports = router;
