"use strict";

const guid        = require('mout/random/guid');

class Job {
  constructor(task, specs, title) {
    this.uuid   = guid();
    //deepclone
    this.specs  = JSON.parse(JSON.stringify(specs));
    this.task   = task;
    this.status = null;
    this.history = [];
    this.initial_update = new Date();
    this.title = title;
  }

  set_status(status, err) {
    let date = new Date();
    this.last_update = date;
    this.status = status;
    this.err    = err;
    this.history.push({status, date});
  }



  export_status() {
    let {uuid, last_update, initial_update, err, history, status} = this;
    return {uuid, last_update, initial_update, err, history, status};
  }
}
module.exports = Job;
