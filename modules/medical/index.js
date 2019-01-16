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

const userUtils = require('../../util/user');
const roleModel = require('../../model/role');

const BaseAlmondUser = require('../default').AlmondUser;

class AlmondUser extends BaseAlmondUser {
    canCreatePermissionRule(rule) {
        // with the the medical policy, patient users with the right role can manage
        // their own policies
        // all policies will be turned into their own policies at the last step
        return !!(this._dbUser &
            (userUtils.Capability.MANAGE_ALL_PERMISSIONS | userUtils.Capability.MANAGE_OWN_PERMISSIONS));
    }

    adjustAndLogPermissionRule(rule, description) {
        throw new Error(`TODO`);
    }

    adjustAndLogProgram(program, description) {
        throw new Error(`TODO`);
    }
}

module.exports = {
    AlmondUser,

    getUserPermissionRules(engine, dbUser) {
        // by default, there are no user-specific permission rules
        return [];
    },
    getUserApps(engine, dbUser) {
        // by default, there are no user-specific apps
        return [];
    },

    async createDefaultRoles(dbClient) {
        await roleModel.create(dbClient, {
            name: 'Patient',
            caps: userUtils.Capability.MANAGE_OWN_PERMISSIONS,
            flags: userUtils.RoleFlags.CAN_REGISTER
        });

        await roleModel.create(dbClient, {
            name: 'Researcher',
            caps: 0,
            flags: userUtils.RoleFlags.CAN_REGISTER
        });

        const rootRole = await roleModel.create(dbClient, {
            name: 'System Administrator',
            caps: userUtils.Capability.ROOT,
            flags: 0
        });
        return rootRole.id;
    }
};
