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

const platform = require('../util/platform');

const req = { _(x) { return x; } };

async function createDefaultUsers(dbClient) {
    req.user = await user.register(dbClient, req, {
        username: 'root',
        password: 'rootroot',
        email: 'root@localhost',
        email_verified: true,
        roles: user.Role.ROOT,
    });
}

async function main() {
    platform.init();

    await db.withTransaction(async (dbClient) => {
        await createDefaultUsers(dbClient);
    });

    await db.tearDown();
}
main();
