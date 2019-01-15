#!/usr/bin/env node
// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond Cloud
//
// Copyright 2018 Google LLC
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

// Bootstrap an installation of Almond Cloud by creating the
// database schema and adding the requisite initial data

require('thingengine-core/lib/polyfill');
process.on('unhandledRejection', (up) => { throw up; });

const db = require('../util/db');
const user = require('../util/user');
const roleModel = require('../util/role');

const platform = require('../util/platform');

const req = { _(x) { return x; } };

async function createDefaultRoles(dbClient) {
    await roleModel.create(dbClient, {
        name: 'User',
        caps: 0,
        flags: user.RoleFlags.CAN_REGISTER
    });

    const rootRole = await roleModel.create(dbClient, {
        name: 'System Administrator',
        caps: user.Role.ROOT,
        flags: 0
    });
    return rootRole.id;
}

async function createDefaultUsers(dbClient, rootRoleId) {
    req.user = await user.register(dbClient, req, {
        username: 'root',
        password: 'rootroot',
        email: 'root@localhost',
        email_verified: true,
        role: rootRoleId,
        approved: true
    });
}

async function main() {
    platform.init();

    await db.withTransaction(async (dbClient) => {
        const rootId = await createDefaultRoles(dbClient);
        await createDefaultUsers(dbClient, rootId);
    });

    await db.tearDown();
}
main();
