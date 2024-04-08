"use strict";

const queue     = require('nyks/async/queue');
const defer     = require('nyks/promise/defer');
const cparser   = require('cron-parser');
const sleep     = require('nyks/async/sleep');

const Job = require('./Job');

const debug      = require('debug');

const log = {
  info  : debug("pulse:info"),
  error : debug("pulse:error"),
  debug : debug("pulse:debug"),
};

const tz = 'Europe/Paris';



class Task {
  constructor(name, executor, failure) {
    this.name         = name;
    this.previous_job = null;
    this.current_job  = null;
    this.executor     = executor;

    this.failure_count  = 0;
    this.success_count = 0;

    this.job_specs    = {};
    this.plan         = false;
    this.next         = false;

    this.execute = queue(this._execute.bind(this), 1);
    this.set_state("idle");
    this.failure = failure || (async () => {});
    this.cancel  = defer();
  }

  //configure require full specs, per design
  configure({plan, ...job_specs} = {}) {
    this.stop();
    this.plan      = plan;
    this.job_specs = job_specs;
    return this;
  }

  stop() {
    if(this.next)
      this.set_state("idle");

    this.next   = false;
    this.cancel.resolve(true);
    this.cancel = defer();
  }

  async start() {
    try {
      this.stop();
      if(!this.plan)
        return;

      let interval = cparser.parseExpression(this.plan, {tz});
      let cancel = this.cancel = defer(), canceled;
      do {
        this.set_state("awaiting");

        this.next    = interval.next().toDate();

        let delay = sleep(this.next - new Date()).then(() => false);

        canceled = await Promise.race([delay, cancel]);

        if(!canceled)
          await this._execute(this.job_specs);
      } while(!canceled);
    } catch(err) {
      log.error("Run failure in task", err);
      this.set_state("run error");
    }
  }

  // we can receive an 'execute" order from outside
  // independently of the main task loop

  async _execute(job_specs) {

    if(!job_specs.image) {
      log.info("Skipping task %s (no image provided)", this.name);
      return false;
    }

    // this should be unreachable
    if(["running"].includes(this.state)) {
      log.info("Skipping running task", this.name);
      return false;
    }

    log.info("Processing task", this.name);

    let job = new Job(this, `Processing ${job_specs.title}`);
    try {
      this.set_state("running", job);
      await this.executor(this, job_specs);
      this.success_count++;
      job.set_status('success');
      return true;
    } catch(err) {
      log.error(err);
      job.set_status("failure", err);
      this.failure_count++;
      this.failure(err, this, job_specs, job).catch(err => console.error(err));
      return false;
    } finally {
      this.set_state("idle"); //push history to previous_job
    }
  }


  set_state(state, job) {
    this.state = state;

    if(!job && this.current_job)
      this.previous_job = this.current_job;

    this.current_job = job;
    if(job)
      job.set_status(state);
  }


  export_status() {
    let {name, current_job, previous_job, next, plan, state, success_count, failure_count, job_specs} = this;
    return {name, next, plan, state, success_count, failure_count,
      current_job  : current_job && current_job.export_status() || undefined,
      previous_job : previous_job && previous_job.export_status() || undefined,
      image : job_specs.image,
    };
  }
}

module.exports = Task;
