// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2019 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Url = require('url');

const Config = require('../config');
const PolicyModule = Config.POLICY_MODULE;

function describeApp(app) {
    return {
        uniqueId: app.uniqueId,
        error: app.error,
        code: app.code,
        slots: app.state,
        icon: app.icon ? Config.THINGPEDIA_URL + '/api/v3/devices/icon/' + app.icon : null
    };
}

function describeDevice(d) {
    return {
        uniqueId: d.uniqueId, name: d.name || ("Unknown device"),
        description: d.description || ("Description not available"),
        kind: d.kind,
        ownerTier: d.ownerTier,
        available: d.available,
        isTransient: d.isTransient,
        isOnlineAccount: d.hasKind('online-account'),
        isDataSource: d.hasKind('data-source'),
        isPhysical: !d.hasKind('online-account') && !d.hasKind('data-source'),
        isThingEngine: d.hasKind('thingengine-system')
    };
}

module.exports = class EnterpriseAlmondBackend {
    constructor(engine, ad) {
        this._engine = engine;
        this._assistant = ad;
    }

    async start() {
    }

    async stop() {
    }

    get assistant() {
        return this._assistant;
    }

    getAllApps() {
        return this._engine.apps.getAllApps().map(describeApp);
    }
    getUserApps(userId) {
        return PolicyModule.getUserApps(this._engine, userId).map(describeApp);
    }
    getApp(appId) {
        const app = this._engine.apps.getApp(appId);
        if (app)
            return describeApp(app);
        else
            return undefined;
    }
    async deleteApp(appId) {
        const app = this._engine.apps.getApp(appId);
        if (!app)
            return false;
        await this._engine.apps.removeApp(app);
        return true;
    }
    async deleteAppForUser(appId, userId) {
        const app = this._engine.apps.getApp(appId);
        if (!app || !PolicyModule.isUserApp(app, userId))
            return false;
        await this._engine.apps.removeApp(app);
        return true;
    }

    getAllPermissions() {
        return this._engine.permissions.getAllPermissions();
    }
    getUserPermissions(userId) {
        return PolicyModule.getUserPermissionRules(this._engine, userId);
    }
    async removePermission(uniqueId) {
        const perm = this._engine.permissions.getPermission(uniqueId);
        if (!perm)
            return false;
        await this._engine.permissions.removePermission(uniqueId);
        return true;
    }
    async removePermissionForUser(uniqueId, userId) {
        const perm = this._engine.permissions.getPermission(uniqueId);
        if (!perm || !PolicyModule.isUserPermissionRule(perm, userId))
            return false;
        await this._engine.permissions.removePermission(uniqueId);
        return true;
    }

    getAllDevices() {
        return this._engine.devices.getAllDevices().map(describeDevice);
    }
    async addDevice(state) {
        return describeDevice(await this._engine.devices.loadOneDevice(state, true));
    }
    async deleteDevice(id) {
        const device = this._engine.devices.getDevice(id);
        if (!device)
            return false;
        await this._engine.devices.removeDevice(device);
        return true;
    }
    startOAuth2(kind) {
        return this._engine.devices.factory.runOAuth2(kind, null).then((result) => {
            if (result === null)
                return [false, '', []];
            else
                return [true, result[0], result[1]];
        });
    }
    async handleOAuth2Callback(kind, redirectUri, session) {
        // we hide the actual http request to simplify marshalling, so the values are fake
        // oauth modules should not rely on these anyway

        let parsed = Url.parse(redirectUri, { parseQueryString: true });
        let req = {
            httpVersion: 1.0,
            headers: [],
            rawHeaders: [],

            method: 'GET',
            url: redirectUri,
            query: parsed.query,
            session: session
        };
        await this._engine.devices.factory.runOAuth2(kind, req);
    }
};
module.exports.prototype.$rpcMethods = ['get assistant',
    'getAllApps', 'getUserApps', 'getApp', 'deleteApp', 'deleteAppForUser',
    'getAllPermissions', 'getUserPermissions', 'removePermission', 'removePermissionForUser',

    'getAllDevices', 'addDevice', 'deleteDevice', 'startOAuth2', 'handleOAuth2Callback'
];
