"use strict";

const path       = require('path');
const get        = require('nyks/object/dive');


class Context {

  constructor(config) {
    if(typeof config == "string")
      this._config = require(path.resolve(config));
    else
      this._config = config || {};
  }


  config(...path) {
    return get(this._config, ...path);
  }

}



module.exports = Context;


