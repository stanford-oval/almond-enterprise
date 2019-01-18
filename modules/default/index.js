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

class AlmondUser {
    constructor(dbUser, engine) {
        this._dbUser = dbUser;
        this._engine = engine;

        this.id = dbUser.cloud_id;
        this.name = dbUser.human_name || dbUser.username;
        this.principal = 'user:' + dbUser.cloud_id;

        this.isOwner = !!(dbUser.caps & userUtils.Capability.ADMIN);
    }

    canConfigureDevice(kind) {
        return !!(this._dbUser.caps & userUtils.Capability.MANAGE_DEVICES);
    }

    canCreatePermissionRule(rule) {
        // by default, only permission managers can manage permissions
        // the manage_own_permissions role is ignored
        return !!(this._dbUser.caps & userUtils.Capability.MANAGE_ALL_PERMISSIONS);
    }

    adjustPermissionRule(rule, description) {
        // return the rule unmodified
        return [rule, description, {}];
    }
    adjustProgram(program, description, appMeta) {
        // return the program unmodified, but mark the user who owns this program
        // (who can later stop it from its dashboard)
        appMeta.owner = this.id;
        return [program, description, appMeta];
    }

    canExecute(program) {
        if ((this._dbUser.caps & userUtils.Capability.MANAGE_ALL_COMMANDS) ||
            (this._dbUser.caps & userUtils.Capability.RUN_UNRESTRICTED_COMMANDS))
            return true;
        if (!(this._dbUser.caps & userUtils.Capability.MANAGE_OWN_COMMANDS))
            return false;
        if (program.principal) // never allow remote execution
            return false;

        // check for permission without modifying the program (quick check on incomplete programs)
        return this._engine.permissions.checkCanBeAllowed(this.principal, program);
    }
    applyPermissionRules(program) {
        if ((this._dbUser.caps & userUtils.Capability.MANAGE_ALL_COMMANDS) ||
            (this._dbUser.caps & userUtils.Capability.RUN_UNRESTRICTED_COMMANDS))
            return program;
        if (program.principal) // never allow remote execution
            return null;

        // check for permission and potentially modify the program
        return this._engine.permissions.checkIsAllowed(this.principal, program);
    }

    async logPermissionRule(uniqueId, permissionRule, description, metadata) {
    }
    async logProgramExecution(uniqueId, program, description, metadata) {
    }
}

module.exports = {
    AlmondUser,

    // by default, there are no user-specific permission rules
    getUserPermissionRules(engine, userId) {
        return [];
    },
    isUserPermissionRule(rule, userId) {
        return false;
    },
    getUserApps(engine, userId) {
        return engine.apps.getAllApps().filter((app) => {
            return app.state.owner === userId;
        });
    },
    isUserApp(app, userId) {
        return app.state.owner === userId;
    },

    async createDefaultRoles(dbClient) {
        await roleModel.create(dbClient, {
            name: 'User',
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
