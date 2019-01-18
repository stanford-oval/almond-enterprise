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

const fs = require('fs');
const path = require('path');
const { EthAudit } = require('ethereum-audit');

const Config = require('../config');

module.exports = class AuditManager {
    constructor() {
        const configJs = path.dirname(require.resolve('../config'));
        const ethConfig = JSON.parse(fs.readFileSync(path.resolve(configJs, Config.ETH_AUDIT_CONFIG_FILE)));
        this._backend = new EthAudit(ethConfig);
    }

    start() {
    }
    stop() {

    }

    async write(key, value) {
        await this._backend.unlockEthAccount();
        await this._backend.insertAuditData({
            key: key,
            data: JSON.stringify(value)
        });
    }
};
