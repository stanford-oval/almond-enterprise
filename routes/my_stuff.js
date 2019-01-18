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

const express = require('express');

const user = require('../util/user');

let router = express.Router();

router.use(user.requireLogIn);

router.get('/conversation', (req, res, next) => {
    res.render('conversation', { page_title: req._("Almond - Conversation View") });
});

router.get('/dashboard', user.requireAnyCap(user.Capability.MANAGE_OWN_PERMISSIONS | user.Capability.MANAGE_OWN_COMMANDS), (req, res, next) => {
    Promise.resolve().then(async () => {
        const backend = req.app.backend;
        const [apps, permissions] = await Promise.all([
            backend.getUserApps(req.user.cloud_id),
            backend.getUserPermissions(req.user.cloud_id)
        ]);

        res.render('my_stuff', {
            page_title: req._("Almond - Dashboard"),
            messages: req.flash('app-message'),
            apps, permissions
        });
    }).catch(next);

});

router.post('/apps/delete', (req, res, next) => {
    Promise.resolve().then(async () => {
        const backend = req.app.backend;
        const ok = await backend.deleteAppForUser(req.body.id, req.user.cloud_id);
        if (ok) {
            req.flash('app-message', "Application successfully deleted");
            res.redirect(303, '/dashboard');
        } else {
            res.status(404).render('error', { page_title: req._("Thingpedia - Error"),
                                              message: req._("Not found.") });
        }
    }).catch(next);
});

router.post('/permissions/delete', (req, res, next) => {
    Promise.resolve().then(async () => {
        const backend = req.app.backend;
        const ok = await backend.removePermissionForUser(req.body.id, req.user.cloud_id);
        if (ok) {
            req.flash('app-message', "Permission successfully revoked");
            res.redirect(303, '/dashboard');
        } else {
            res.status(404).render('error', { page_title: req._("Thingpedia - Error"),
                                              message: req._("Not found.") });
        }
    }).catch(next);
});

module.exports = router;
