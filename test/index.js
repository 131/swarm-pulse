"use strict";

const path = require('path');
const fs   = require('fs');

const expect = require('expect.js');
const Pulse  = require('../lib/Pulse');
const yaml = require('js-yaml');
const sleep = require('nyks/async/sleep');

describe("Initial test suite", function() {

  let config = {STACK_NAME : 'pulse-ci'};
  this.timeout(60 * 1000);


  let pulse = new Pulse(config);

  it("Should load sample tasks", () => {
    let config = fs.readFileSync(path.join(__dirname, 'tasks-simple.yml'), 'utf-8');
    let {tasks} = yaml.load(config);
    for(let [task_name, task_specs] of Object.entries(tasks)) {
      let task = pulse.register(task_name);
      if(task)
        task.configure(task_specs);
    }

    expect(Object.keys(pulse.tasks)).to.eql(Object.keys(tasks));
  });




  it("should prevent double execute", async () => {
    let task_sum = "bash/sum";
    let foo = await Promise.all([pulse.execute(task_sum), pulse.execute(task_sum)]);
    expect(foo).to.eql([true, true]);

    let {previous_job, success_count, failure_count} = pulse.tasks[task_sum];
    expect(success_count).to.eql(2);
    expect(failure_count).to.eql(0);

    expect(previous_job.status).to.eql("success");
  });

  it("should fail on failure", async () => {
    let task_failure = "bash/failure";
    let foo = await pulse.execute(task_failure);
    expect(foo).to.eql(false);

    let {success_count, failure_count, previous_job} = pulse.tasks[task_failure].export_status();

    expect(success_count).to.eql(0);
    expect(failure_count).to.eql(1);

    expect(previous_job.status).to.eql("failure");
  });



  it("should execute on loop", async () => {
    let task_name = "bash/hostname-loop";
    let task = pulse.tasks[task_name];
    task.start();

    let last = 0;
    do {
      let {success_count} = task;
      if(success_count != last) {
        last = success_count;
        console.log("Got execution", last);
      }
      if(success_count == 4)
        break;
      await sleep(1000);
    } while(true);

    task.stop();
  });




});
