"use strict";


const debug      = require('debug');


const reduce    = require('mout/object/reduce');

const sleep     = require('nyks/async/sleep');

const Context     = require('./context');

const Stack        = require('@131/docker-sdk/stack');
const RegistryAuth = require('@131/docker-sdk/registry-auth');


const metadata    = require('../package.json');

const Task = require('./Task');



const log = {
  info  : debug("pulse:info"),
  error : debug("pulse:error"),
  debug : debug("pulse:debug"),
};




const DRY_MODE = "PULSE_DRY_MODE" in process.env;
const uptime = new Date();


class Pulse {

  constructor(config_path = (process.env['PULSE_CONFIG_PATH'])) {
    this.ctx = new Context(config_path);

    this.STACK_NAME  = this.ctx.config('STACK_NAME') || process.env.STACK_NAME;
    if(!this.STACK_NAME)
      throw `Cannot lookup STACK_NAME (plz check env)`;

    this.tasks_ns = `${this.STACK_NAME}_pulse_tasks`;

    this.tasks    = {};

    let tasks = this.ctx.config('tasks') || {};

    for(let [name, task_specs] of Object.entries(tasks)) {
      let task = this.register(name);
      if(task)
        task.configure(task_specs).start();
    }

    this.stack_sdk    = new Stack(this.STACK_NAME, this.ctx.config('docker'));
    this.registry_auth = new RegistryAuth(this.ctx.config('registries') || {});

    log.info("Loaded %d tasks", Object.keys(this.tasks).length);
  }

  unregister(name) {
    if(!this.tasks[name])
      return;

    log.info("Stop task %s", name);
    this.tasks[name].stop();
    log.info("Disable task %s", name);
    delete this.tasks[name];
  }

  register(name) {
    if(name[0] == ".") {
      log.info("Skipping disabled task %s", name);
      return;
    }

    let task = this.tasks[name];
    if(!task) {
      task = new Task(name, this._executor.bind(this));
      this.tasks[name] = task;
    }

    return task;
  }

  async _executor({name : task_name}, job_specs) {
    const service_payload = await this.stack_sdk.compose_service(task_name, job_specs, this.tasks_ns);
    const credentials = this.registry_auth.get_image_auth(job_specs.image);
    if(DRY_MODE) {
      await sleep(20 * 1000);
      log.debug('Dry mode, skipping', task_name);
      return;
    }
    return  this.stack_sdk.service_exec(service_payload, credentials);
  }


  // for cli
  async execute(task_name, job_specs = undefined) {
    const task = this.tasks[task_name];
    if(!task)
      throw `Invalid task`;

    let [, execute] = task.execute(job_specs);
    return execute;
  }



  async check_tasks_images() {
    if(this.ctx.config('disable_image_lookup'))
      return log.info("Image lookup disabled, skipping image lookup");

    let images_list = reduce(this.tasks,
      (acc, {job_specs : {image} }) => (image && !acc.includes(image) && acc.push(image), acc),
      []
    );

    log.info("Checking tasks images availability", images_list, this.tasks);

    for(const image of images_list) {
      log.info("Checking image", image);
      await this.registry_auth.get_image_manifest(image);
    }
  }


  async cleanup() {
    //pruning old tasks
    const ghost_services = await this.stack_sdk.services_list({namespace : this.tasks_ns});

    if(ghost_services.length) {
      log.info("Cleaning up %d ghost services from previous run", ghost_services.length);
      for(let service of ghost_services)
        await this.stack_sdk.service_delete(service.ID);
    }
  }



  export_metrics() {
    var metrics = [];

    for(let [task_guid, {job_specs, previous_job, success_count, failure_count, total_duration}] of Object.entries(this.tasks)) {
      let task_image = job_specs.image;
      if(previous_job) {
        let {initial_update, last_update} = previous_job;
        metrics.push(`task_last_tick_ms{task_guid="${task_guid}",task_image="${task_image}"} ${Number(last_update)}`);
        metrics.push(`task_last_duration_ms{task_guid="${task_guid}",task_image="${task_image}"} ${Number(last_update - initial_update)}`);
        metrics.push(`task_total_duration_ms{task_guid="${task_guid}",task_image="${task_image}"} ${Number(total_duration)}`);
      }
      metrics.push(`task_tick_count{task_guid="${task_guid}",task_image="${task_image}"} ${Number(success_count)}`);
      metrics.push(`task_error_count{task_guid="${task_guid}",task_image="${task_image}"} ${Number(failure_count)}`);
    }

    return metrics.join("\n");
  }


  export_status() {
    const {version} = metadata;
    var tasks = {};

    for(let task_guid  of Object.keys(this.tasks).sort())
      tasks[task_guid] = this.tasks[task_guid].export_status();

    return {uptime, tasks, version, stack_name : this.STACK_NAME};
  }

}






module.exports = Pulse;
