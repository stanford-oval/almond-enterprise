// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

// Graphics API abstraction, based on nodejs-gm

const gm = require('gm');

class Image {
    constructor(how) {
        this._gm = gm(how);
    }

    getSize() {
        return new Promise((resolve, reject) => {
            this._gm.size((err, res) => {
                if (err)
                    reject(err);
                else
                    resolve(res);
            });
        });
    }

    resizeFit(width, height) {
        this._gm = this._gm.resize(width, height);
    }

    stream(format) {
        return new Promise((resolve, reject) => {
            this._gm.stream(format, (err, res) => {
                if (err)
                    reject(err);
                else
                    resolve(res);
            });
        });
    }

    toBuffer() {
        return new Promise((resolve, reject) => {
            this._gm.toBuffer((err, res) => {
                if (err)
                    reject(err);
                else
                    resolve(res);
            });
        });
    }
}

module.exports = {
    createImageFromPath(path) {
        return new Image(path);
    },

    createImageFromBuffer(buffer) {
        return new Image(buffer);
    },
};

