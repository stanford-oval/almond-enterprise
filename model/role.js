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

const db = require('../util/db');

module.exports = {
    async create(dbClient, role) {
        const id = await db.insertOne(dbClient, `insert into roles set ?`, [role]);
        role.id = id;
        return role;
    },

    update(dbClient, id, role) {
        return db.query(dbClient, `update roles set ? where id = ?`, [role, id]);
    },

    get(dbClient, id) {
        return db.selectOne(dbClient, `select * from roles where id = ?`, [id]);
    },

    getAll(dbClient) {
        return db.selectAll(dbClient, `select * from roles order by name asc`);
    },

    getAllWithFlag(dbClient, flag) {
        return db.selectAll(dbClient, `select * from roles where (flags & ?) = ? order by name asc`, [flag, flag]);
    }
};
