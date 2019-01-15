// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015-2018 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

// Server platform

const Q = require('q');
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');
//const CVC4Solver = require('cvc4');
const CVC4Solver = require('smtlib').LocalCVC4Solver;

const Assistant = require('./assistant');
const graphics = require('../util/graphics');
const i18n = require('../util/i18n');

const Config = require('../config');

const prefs = require('thingengine-core/lib/util/prefs');

var _unzipApi = {
    unzip(zipPath, dir) {
        var args = ['-uo', zipPath, '-d', dir];
        return Q.nfcall(child_process.execFile, '/usr/bin/unzip', args, {
            maxBuffer: 10 * 1024 * 1024 }).then((zipResult) => {
            var stdout = zipResult[0];
            var stderr = zipResult[1];
            console.log('stdout', stdout);
            console.log('stderr', stderr);
        });
    }
};

function safeMkdirSync(dir) {
    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if (e.code !== 'EEXIST')
            throw e;
    }
}

module.exports = {
    // Initialize the platform code
    // Will be called before instantiating the engine
    init() {
        this._assistant = null;

        this._writabledir = process.cwd();
        safeMkdirSync(this._writabledir + '/cache');

        this._gettext = i18n.get();
        this._locale = this._gettext.locale;

        this._timezone = process.env.TZ || 'America/Los_Angeles';
        this._prefs = new prefs.FilePreferences(this._writabledir + '/prefs.db');

        this._sqliteKey = Config.THINGENGINE_STORAGE_KEY;
        this._developerKey = Config.THINGPEDIA_DEVELOPER_KEY;

        this._assistant = null;
    },

    createAssistant(engine, options) {
        this._assistant = new Assistant(engine, options);
        // for compat
        engine.assistant = this._assistant;
    },

    type: 'server',

    get encoding() {
        return 'utf8';
    },

    get locale() {
        return this._locale;
    },

    get timezone() {
        return this._timezone;
    },

    // Check if we need to load and run the given thingengine-module on
    // this platform
    // (eg we don't need discovery on the cloud, and we don't need graphdb,
    // messaging or the apps on the phone client)
    hasFeature(feature) {
        switch(feature) {
        case 'discovery':
            return false;

        default:
            return true;
        }
    },

    getPlatformDevice() {
        return null;
    },

    // Check if this platform has the required capability
    // (eg. long running, big storage, reliable connectivity, server
    // connectivity, stable IP, local device discovery, bluetooth, etc.)
    //
    // Which capabilities are available affects which apps are allowed to run
    hasCapability(cap) {
        switch(cap) {
        case 'code-download':
        case 'graphics-api':
        case 'assistant':
        case 'gettext':
        case 'smt-solver':
            return true;

        default:
            return false;
        }
    },

    // Retrieve an interface to an optional functionality provided by the
    // platform
    //
    // This will return null if hasCapability(cap) is false
    getCapability(cap) {
        switch(cap) {
        case 'code-download':
            // We have the support to download code
            return _unzipApi;

        case 'graphics':
        case 'graphics-api':
            return graphics;

        case 'smt-solver':
            return CVC4Solver;

        case 'assistant':
            return this._assistant;

        case 'gettext':
            return this._gettext;

        default:
            return null;
        }
    },

    // Obtain a shared preference store
    // Preferences are simple key/value store which is shared across all apps
    // but private to this instance (tier) of the platform
    // Preferences should be normally used only by the engine code, and a persistent
    // shared store such as DataVault should be used by regular apps
    getSharedPreferences() {
        return this._prefs;
    },

    // Get a directory that is guaranteed to be writable
    // (in the private data space for Android, in the current directory for server)
    getWritableDir() {
        return this._writabledir;
    },

    // Get a directory good for long term caching of code
    // and metadata
    getCacheDir() {
        return this._writabledir + '/cache';
    },

    // Get a temporary directory
    // Also guaranteed to be writable, but not guaranteed
    // to persist across reboots or for long times
    // (ie, it could be periodically cleaned by the system)
    getTmpDir() {
        return os.tmpdir();
    },

    // Get the filename of the sqlite database
    getSqliteDB() {
        return this._writabledir + '/sqlite.db';
    },

    // Get the encryption key of the sqlite database
    getSqliteKey() {
        return this._sqliteKey;
    },

    // Get the Thingpedia developer key, if one is configured
    getDeveloperKey() {
        return this._developerKey;
    },

    // Change the Thingpedia developer key, if possible
    // Returns true if the change actually happened
    setDeveloperKey() {
        return false;
    },

    // Return a server/port URL that can be used to refer to this
    // installation. This is used for OAuth redirects, and
    // so must match what the upstream services accept
    // Our /devices/oauth2 router is mounted under /admin, so we add /admin here
    getOrigin() {
        return Config.SERVER_ORIGIN + '/admin';
    },

    getCloudId() {
        return null;
    },

    getAuthToken() {
        return null;
    },

    // Change the auth token
    // Returns true if a change actually occurred, false if the change
    // was rejected
    setAuthToken(authToken) {
        // the auth token is stored outside in the mysql db, we can never
        // change it
        return false;
    }
};
