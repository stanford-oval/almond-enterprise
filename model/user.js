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

const db = require('../util/db');

function create(client, user) {
    return db.insertOne(client, `insert into users set ?`, [user]).then((id) => {
        user.id = id;
        return user;
    });
}

module.exports = {
    get(client, id) {
        return db.selectOne(client, "select u.*,r.name as role_name,if(approved,r.caps,0) as caps from users u, roles r where u.id = ? and r.id = u.role", [id]);
    },

    getSearch(client, search) {
        search = '%' + search + '%';
        return db.selectAll(client, "select u.*,r.name as role_name,if(approved,r.caps,0) as caps from users u, roles r where username like ? or human_name like ? or email like ? and r.id = u.role",
                            [search, search, search]);
    },

    getByName(client, username) {
        return db.selectAll(client, "select u.*,r.name as role_name,if(approved,r.caps,0) as caps from users u, roles r where username = ? and r.id = u.role", [username]);
    },

    getByCloudId(client, cloudId) {
        return db.selectAll(client, "select u.*,r.name as role_name,if(approved,r.caps,0) as caps from users u, roles r where cloud_id = ? and r.id = u.role", [cloudId]);
    },

    getIdByCloudId(client, cloudId) {
        return db.selectOne(client, "select id from users u where cloud_id = ?", [cloudId]);
    },

    create,

    update(client, id, user) {
        return db.query(client, "update users set ? where id = ?", [user, id]);
    },
    delete(client, id) {
        return db.query(client, "delete from users where id = ?", [id]);
    },

    getAll(client, start, end) {
        if (start !== undefined && end !== undefined)
            return db.selectAll(client, "select u.*,r.name as role_name,if(approved,r.caps,0) as caps from users u, roles r where r.id = u.role order by u.id limit ?,?", [start,end]);
        else
            return db.selectAll(client, "select u.*,r.name as role_name,if(approved,r.caps,0) as caps from users u, roles r where r.id = u.role order by u.id");
    },

    recordLogin(client, userId) {
        return db.query(client, "update users set lastlog_time = current_timestamp where id = ?", [userId]);
    },

    verifyEmail(client, cloudId, email) {
        return db.query(client, "update users set email_verified = true where cloud_id = ? and email = ?", [cloudId, email]);
    }
};
