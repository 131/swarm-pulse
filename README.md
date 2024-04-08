# Setup

export PULSE_CONFIG_PATH=$(pwd)/test/tasks-offline.json
export DEBUG=*,-express:*,-send,-eslint:*,-eslintrc:*


# Query plan
```

*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, optional)


0 */2     * * *
=> trigger every 2 hour
```


#  Persistence

By design, we avoir keeping any persistence, task are awaited until their scheduled trigger. If the trigger is missed, the tasks will have to wait until the next event.



# Status
* **running**   (sql query is ongoing)
* **pending**   (query is scheduled to be executed ASAP)
* **scheduled** (query is awaiting a futur trigger)



# Overlap
Overlapping tasks are _dropped_. I.e. : if as task currently **running** (or **pending**) and the schedule trigger is fired, execution order will be droppped (until next tick)

Killing  the daemon will abort all running (and pending) tasks until next scheduled trigger.



