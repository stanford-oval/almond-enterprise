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

const TT = require('thingtalk');

const userUtils = require('../../util/user');
const roleModel = require('../../model/role');

const BaseAlmondUser = require('../default').AlmondUser;

class AlmondUser extends BaseAlmondUser {
    constructor(user, engine, auditManager) {
        super(user, engine);
        this._audit = auditManager;
    }

    canCreatePermissionRule(rule) {
        // with the the medical policy, patient users with the right role can manage
        // their own policies
        // all policies will be turned into their own policies at the last step
        return !!(this._dbUser.caps &
            (userUtils.Capability.MANAGE_ALL_PERMISSIONS | userUtils.Capability.MANAGE_OWN_PERMISSIONS));
    }

    async adjustProgram(program, description, appMeta) {
        appMeta.owner = this._dbUser.cloud_id;

        if (this._dbUser.caps & userUtils.Capability.MANAGE_ALL_COMMANDS)
            return [program, description, appMeta];

        if (this._dbUser.caps & userUtils.Capability.RUN_UNRESTRICTED_COMMANDS) {
            for (let rule of program.rules) {
                const filter = TT.Ast.BooleanExpression.Atom('patient', '==', TT.Ast.Value.String(this._dbUser.cloud_id));
                if (rule.stream)
                    rule.stream = TT.Ast.Stream.Filter(rule.stream, filter, rule.stream.schema);
                else if (rule.table)
                    rule.table = TT.Ast.Table.Filter(rule.table, filter, rule.table.schema);
            }
            return [program.optimize(), description, appMeta];
        } else {
            return [program, description, appMeta];
        }
    }

    async adjustPermissionRule(rule, description) {
        if (this._dbUser.caps & userUtils.Capability.MANAGE_ALL_PERMISSIONS)
            return [rule, description, {}];

        const metadata = {
            owner: this._dbUser.cloud_id
        };

        if (rule.query.isBuiltin)
            throw new Error(`Unexpected builtin query`);
        if (rule.query.isStar || rule.query.isClassStar)
            rule.query = new TT.Ast.PermissionFunction.Specified('com.mai-hub', 'find', TT.Ast.BooleanExpression.True, null);

        rule.query.filter = TT.Ast.BooleanExpression.And([
            rule.query.filter,
            TT.Ast.BooleanExpression.Atom('patient', '==', TT.Ast.Value.String(this._dbUser.cloud_id))
        ]).optimize();

        await rule.typecheck(this._engine.schemas, true);
        description = TT.Describe.describePermissionRule(this._engine.platform.getCapability('gettext'), rule);

        return [rule, description, metadata];
    }

    async logPermissionRule(uniqueId, permissionRule, description, metadata) {
        await this._audit.write('policy:' + uniqueId, {
            c: permissionRule.prettyprint(),
            d: description,
            u: metadata.owner
        });
    }

    async logProgramExecution(uniqueId, program, description) {
        await this._audit.write('program:' + uniqueId, {
            c: program.prettyprint(true),
            d: description,
            u: this._dbUser.cloud_id
        });
    }
}

module.exports = {
    AlmondUser,

    getUserPermissionRules(engine, userId) {
        return engine.permissions.getAllPermissions().filter((rule) => {
            return rule.metadata.owner === userId;
        });
    },
    isUserPermissionRule(rule, userId) {
        return rule.metadata.owner === userId;
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
            name: 'Patient',
            caps: userUtils.Capability.MANAGE_OWN_PERMISSIONS | userUtils.Capability.MANAGE_OWN_COMMANDS | userUtils.Capability.RUN_UNRESTRICTED_COMMANDS,
            flags: userUtils.RoleFlags.CAN_REGISTER
        });

        await roleModel.create(dbClient, {
            name: 'Researcher',
            caps: userUtils.Capability.MANAGE_OWN_COMMANDS,
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
