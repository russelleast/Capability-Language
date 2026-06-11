# Notes

* Is the language single or multiple file? -> (multi)
* Should named elements being imported into other files? yes but instead if undering, imports use "depends on .. from  {capabilitiy}"
  * this could mean that actors are defined in a single file (for example)

* capability hierarchy, need to think how to support this as invariants, intends and outcomes could defer. This need to be thought through. I do see benefit of a capability paramid.

* How does the DCL be testable, it could get very low level like specflow which is not desirable

* Policies, should include characteristics with SLOs, System quality attributies. 

* Maybe add metrics to rules?

* Based om v0.1, with a statemachine belonging to a capability, should a big statemachine handle many capabilities. this should like orchestration/choelography. Would this be a belong to a high level (l1) capability. For example:

Capability: Job management

Lifecycle: pending -> in progress -> complete or failed (retry x times)

Createing job is a capability
Different capabilities do the jobs, they need to update the job status and progress (percentage)
Retrying, failing and complete could be part of the job management capability

* Could DCL describe UI behavior (no, this is not core to capabilities, maybe an extension in the future)
* Could DCL describe queries 
* Could DCL describe batch jobs
* Could DCL describe file processing

* Data types: Id, token, sensitive

* policy: 
  - retry times(x) 
  - retry delay (time)
  - retry staggered delay (time) 





