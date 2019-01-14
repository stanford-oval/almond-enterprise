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

const net = require('net');
const events = require('events');
const rpc = require('transparent-rpc');
const sockaddr = require('sockaddr');

const JsonDatagramSocket = require('../util/json_datagram_socket');

const Config = require('../config');

var _instance;

module.exports = class BackendClient extends events.EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(Infinity);

        this._expectClose = false;
        this._reconnectTimeout = null;
        this._rpcControl = null;
        this._rpcSocket = null;

        _instance = this;
    }

    static get() {
        return _instance;
    }

    _connect() {
        if (this._rpcControl)
            return;

        this._controlSocket = new net.Socket();
        this._controlSocket.connect(sockaddr(Config.BACKEND_ADDRESS));

        let jsonSocket = new JsonDatagramSocket(this._controlSocket, this._controlSocket, 'utf8');
        this._rpcSocket = new rpc.Socket(jsonSocket);

        const ready = (msg) => {
            if (msg.control === 'ready') {
                console.log('Control channel to EngineManager ready');
                this._rpcControl = this._rpcSocket.getProxy(msg.rpcId);
                jsonSocket.removeListener('data', ready);
            }
        };
        jsonSocket.on('data', ready);
        this._rpcSocket.on('close', () => {
            if (this._expectClose)
                return;

            this._rpcSocket = null;
            this._rpcControl = null;
            console.log('Control channel to backend severed');
            console.log('Reconnecting in 10s...');
            setTimeout(() => {
                this._connect();
            }, 10000);
        });
        this._rpcSocket.on('error', () => {
            // ignore the error, the socket will be closed soon and we'll deal with it
        });
    }

    start() {
        this._connect();
    }

    stop() {
        if (!this._rpcSocket)
            return;

        this._expectClose = true;
        this._rpcSocket.end();

        for (let engine in this._cachedEngines.values())
            engine.socket.end();
    }

    // frontend<->backend API here...
};
