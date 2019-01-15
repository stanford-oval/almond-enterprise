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

const user = require('../util/user');
const model = require('../model/user');
const db = require('../util/db');

var router = express.Router();

const USERS_PER_PAGE = 50;

router.use(user.requireLogIn);

router.get('/', user.requireAnyCap(user.Capability.ALL_ADMIN), (req, res, next) => {
    res.render('admin_portal', { page_title: req._("Almond - Administration"),
                                 csrfToken: req.csrfToken() });
});

router.get('/users', user.requireCap(user.Capability.MANAGE_USERS), (req, res) => {
    let page = req.query.page;
    if (page === undefined)
        page = 0;
    page = parseInt(page);
    if (isNaN(page) || page < 0)
        page = 0;

    db.withClient((dbClient) => {
        return model.getAll(dbClient, page * USERS_PER_PAGE, USERS_PER_PAGE + 1);
    }).then((users) => {
        res.render('admin_user_list', { page_title: req._("Almond - Administration"),
                                        csrfToken: req.csrfToken(),
                                        users: users,
                                        page_num: page,
                                        search: '',
                                        USERS_PER_PAGE });
    });
});

router.get('/users/search', user.requireCap(user.Capability.MANAGE_USERS), (req, res) => {
    db.withClient((dbClient) => {
        if (req.query.q !== '' && !isNaN(req.query.q))
            return Promise.all([model.get(dbClient, Number(req.query.q))]);
        else
            return model.getSearch(dbClient, req.query.q);
    }).then((users) => {
        res.render('admin_user_list', { page_title: req._("Almond - User List"),
                                        csrfToken: req.csrfToken(),
                                        users: users,
                                        page_num: 0,
                                        search: req.query.search,
                                        USERS_PER_PAGE });
    });
});

router.post('/users/delete', user.requireCap(user.Capability.ADMIN), (req, res) => {
    if (req.user.id === req.body.id) {
        res.render('error', { page_title: req._("Almond - Error"),
                              message: req._("You cannot delete yourself") });
        return;
    }

    db.withTransaction((dbClient) => {
        return model.delete(dbClient, req.body.id);
    }).then(() => {
        res.redirect(303, '/admin/users');
    }).catch((e) => {
        res.status(500).render('error', { page_title: req._("Almond - Error"),
                                          message: e });
    });
});

router.post('/users/approve', user.requireCap(user.Capability.MANAGE_USERS), (req, res) => {
    db.withTransaction((dbClient) => {
        return model.update(dbClient, req.body.id, { approved: true });
    }).then(() => {
        res.redirect(303, '/admin/users');
    }).catch((e) => {
        res.status(500).render('error', { page_title: req._("Almond - Error"),
                                          message: e });
    });
});

module.exports = router;
