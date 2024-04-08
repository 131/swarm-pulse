"use strict";



class Job {
  constructor(task, title) {
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
    let {last_update, initial_update, err, history, status} = this;
    return {last_update, initial_update, err, history, status};
  }
}
module.exports = Job;
