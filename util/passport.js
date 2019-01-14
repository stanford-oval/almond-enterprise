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

const crypto = require('crypto');
const util = require('util');
const jwt = require('jsonwebtoken');

const db = require('./db');
const model = require('../model/user');
const secret = require('./secret_key');

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const TotpStrategy = require('passport-totp').Strategy;

const TOTP_PERIOD = 30; // duration in second of TOTP code

function hashPassword(salt, password) {
    // FIXME stronger hashing
    return util.promisify(crypto.pbkdf2)(password, salt, 10000, 32, 'sha1')
        .then((buffer) => buffer.toString('hex'));
}

exports.initialize = function() {
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        db.withClient((client) => model.get(client, id)).nodeify(done);
    });

    passport.use(new BearerStrategy(async (accessToken, done) => {
        try {
            const decoded = await util.promisify(jwt.verify)(accessToken, secret.getJWTSigningKey(), {
                algorithms: ['HS256'],
                audience: 'oauth2',
                clockTolerance: 30,
            });
            const scope = decoded.scope || ['profile'];
            const [user, options] = await db.withClient(async (dbClient) => {
                const rows = await model.getByCloudId(dbClient, decoded.sub);
                if (rows.length < 1)
                    return [false, null];

                await model.recordLogin(dbClient, rows[0].id);
                return [rows[0], { scope, authMethod: 'oauth2' }];
            });
            done(null, user, options);
        } catch(err) {
            done(err);
        }
    }));

    passport.use(new LocalStrategy((username, password, done) => {
        db.withClient((dbClient) => {
            return model.getByName(dbClient, username).then((rows) => {
                if (rows.length < 1)
                    return [false, "Invalid username or password"];

                return hashPassword(rows[0].salt, password).then((hash) => {
                    if (hash !== rows[0].password)
                        return [false, "Invalid username or password"];

                    return model.recordLogin(dbClient, rows[0].id).then(() => {
                        return [rows[0], null];
                    });
                });
            });
        }).then((result) => {
            done(null, result[0], { message: result[1] });
        }, (err) => {
            done(err);
        }).done();
    }));

    passport.use(new TotpStrategy((user, done) => {
        if (user.totp_key === null)
            done(new Error('2-factor authentication not setup'));
        else
            done(null, secret.decrypt(user.totp_key), TOTP_PERIOD);
    }));
};
