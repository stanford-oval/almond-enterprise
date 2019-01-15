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

const assert = require('assert');
const crypto = require('crypto');
const util = require('util');

const model = require('../model/user');
const { makeRandom } = require('./random');

function hashPassword(salt, password) {
    return util.promisify(crypto.pbkdf2)(password, salt, 10000, 32, 'sha1')
        .then((buffer) => buffer.toString('hex'));
}

const OAuthScopes = new Set([
    'profile', // minimum scope: see the user's profile

    'user-read', // read active commands and devices
    'user-read-results', // read results of active commands
    'user-exec-command', // execute thingtalk (includes web almond access)

]);

function isAuthenticated(req) {
    if (!req.user)
        return false;

    // no need for 2fa when using OAuth tokens
    if (req.authInfo && req.authInfo.authMethod === 'oauth2')
        return true;

    // no need for 2fa when 2fa is not setup
    if (req.user.totp_key === null)
        return true;

    return req.session.completed2fa;
}

const Capability = {
    ADMIN: 1,
    MANAGE_USERS: 2,
    MANAGE_DEVICES: 4,
    MANAGE_OWN_PERMISSIONS: 8,
    MANAGE_ALL_PERMISSIONS: 16,
    MANAGE_OWN_COMMANDS: 32,
    MANAGE_ALL_COMMANDS: 64,

    // all privileges
    ROOT: 127,
    // all admin privileges
    ALL_ADMIN: 1+2+4+16+64
};

module.exports = {
    OAuthScopes,
    Capability,

    RoleFlags: {
        CAN_REGISTER: 1,
        REQUIRE_APPROVAL: 2
    },

    ProfileFlags: {
        SHOW_HUMAN_NAME: 1,
        SHOW_EMAIL: 2,
    },

    register(dbClient, req, options) {
        return model.getByName(dbClient, options.username).then((rows) => {
            if (rows.length > 0)
                throw new Error(req._("A user with this name already exists"));

            var salt = makeRandom();
            var cloudId = makeRandom(8);
            return hashPassword(salt, options.password).then((hash) => {
                return model.create(dbClient, {
                    username: options.username,
                    human_name: options.human_name || null,
                    password: hash,
                    email: options.email,
                    role: options.role,
                    approved: options.approved,
                    email_verified: options.email_verified || false,
                    salt: salt,
                    cloud_id: cloudId,
                    profile_flags: options.profile_flags || 0,
                });
            });
        });
    },

    recordLogin(dbClient, userId) {
        return model.recordLogin(dbClient, userId);
    },

    async update(dbClient, user, oldpassword, password) {
        if (user.salt && user.password) {
            const providedHash = await hashPassword(user.salt, oldpassword);
            if (user.password !== providedHash)
                throw new Error('Invalid old password');
        }
        const salt = makeRandom();
        const newhash = await hashPassword(salt, password);
        await model.update(dbClient, user.id, { salt: salt,
                                                 password: newhash });
        user.salt = salt;
        user.password = newhash;
    },

    async resetPassword(dbClient, user, password) {
        const salt = makeRandom();
        const newhash = await hashPassword(salt, password);
        await model.update(dbClient, user.id, { salt: salt,
                                                password: newhash });
        user.salt = salt;
        user.password = newhash;
    },

    isAuthenticated,
    requireLogIn(req, res, next) {
        if (isAuthenticated(req)) {
            next();
            return;
        }

        if (req.method === 'GET' || req.method === 'HEAD') {
            req.session.redirect_to = req.originalUrl;
            if (req.user)
                res.redirect('/user/2fa/login');
            else
                res.redirect('/user/login');
        } else {
            res.status(401).render('login_required',
                                   { page_title: req._("Thingpedia - Error") });
        }
    },

    requireCap(cap) {
        if (typeof cap !== 'number')
            throw new TypeError(`Invalid call to requireRole`);
        return function(req, res, next) {
            if ((req.user.caps & cap) !== cap) {
                res.status(403).render('error', {
                    page_title: req._("Thingpedia - Error"),
                    message: req._("You do not have permission to perform this operation.")
                });
            } else {
                next();
            }
        };
    },

    requireAnyCap(cap) {
        if (typeof cap !== 'number')
            throw new TypeError(`Invalid call to requireAnyRole`);
        return function(req, res, next) {
            if ((req.user.caps & cap) === 0) {
                res.status(403).render('error', {
                    page_title: req._("Thingpedia - Error"),
                    message: req._("You do not have permission to perform this operation.")
                });
            } else {
                next();
            }
        };
    },

    requireScope(scope) {
        assert(OAuthScopes.has(scope));
        return function(req, res, next) {
            if (!req.authInfo) {
                next();
                return;
            }

            if (req.authInfo.scope.indexOf(scope) < 0) {
                res.status(403).json({error:'invalid scope'});
                return;
            }

            next();
        };
    }
};
