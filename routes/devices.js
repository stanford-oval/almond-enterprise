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
var router = express.Router();

const user = require('../util/user');

router.get('/', user.requireLogIn, user.requireCap(user.Capability.MANAGE_DEVICES), (req, res, next) => {
    req.app.backend.getAllDevices().then((devices) => {
        devices = devices.filter((d) => !d.isThingEngine);
        res.render('devices_list', { page_title: 'Almond - Configured Devices', devices });
    }).catch(next);
});

router.get('/create', user.requireLogIn, user.requireCap(user.Capability.MANAGE_DEVICES), (req, res, next) => {
    if (req.query.class && ['online', 'physical', 'data'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: req._("Almond - Error"),
                                          message: req._("Invalid device class") });
        return;
    }

    res.render('devices_create', { page_title: req._("Almond - Configure device"),
                                   csrfToken: req.csrfToken(),
                                   klass: req.query.class,
                                   ownTier: 'cloud',
                                 });
});

router.post('/create', user.requireLogIn, user.requireCap(user.Capability.MANAGE_DEVICES), (req, res, next) => {
    Promise.resolve().then(async () => {
        if (typeof req.body['kind'] !== 'string' ||
            req.body['kind'].length === 0) {
            res.status(400).render('error', { page_title: "Almond - Error",
                                              message: req._("You must choose one kind of device") });
            return;
        }

        delete req.body['_csrf'];
        await req.app.backend.addDevice(req.body);
        if (req.session['device-redirect-to']) {
            res.redirect(303, req.session['device-redirect-to']);
            delete req.session['device-redirect-to'];
        } else {
            res.redirect(303, '/admin/devices');
        }
    }).catch(next);
});

router.post('/delete', user.requireLogIn, user.requireCap(user.Capability.MANAGE_DEVICES), (req, res, next) => {
    Promise.resolve().then(async () => {
        const ok = await req.app.backend.deleteDevice(req.body.id);
        if (!ok) {
            res.status(404).render('error', { page_title: "Almond - Error",
                                              message: "Not found." });
            return;
        }
        res.redirect('/admin/devices');
    }).catch(next);
});

router.get('/oauth2/:kind', user.requireLogIn, user.requireCap(user.Capability.MANAGE_DEVICES), (req, res, next) => {
    Promise.resolve().then(async () => {
        const [ok, redirect, session] = await req.app.backend.startOAuth2(req.params.kind);

        if (ok) {
            for (var key in session)
                req.session[key] = session[key];
            res.redirect(redirect);
        } else {
            res.redirect('/admin/devices');
        }
    }).catch(next);
});

router.get('/oauth2/callback/:kind', user.requireLogIn, user.requireCap(user.Capability.MANAGE_DEVICES), (req, res, next) => {
    Promise.resolve().then(async () => {
        await req.app.backend.handleOAuth2Callback(req.params.kind, req.url, req.session);
        res.redirect('/admin/devices');
    }).catch(next);
});


module.exports = router;
