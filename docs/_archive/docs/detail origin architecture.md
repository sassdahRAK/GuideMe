# Universal Tutorial Engine — System Architecture Diagram

This document presents the component-level system layout for the Universal Tutorial Engine, focusing on interactive UI guidance overlays, step prompt boxes, and event-driven step validation.

---

## High-Level Architecture Diagram

```text
                  +-----------------------------------+
                  |      Tutorial Authoring System    |
                  |                                   |
                  |  Visual Builder / JSON Editor     |
                  +----------------+------------------+
                                   |
                                   v
                  +-----------------------------------+
                  |       Tutorial Definition         |
                  |           JSON / DSL              |
                  +----------------+------------------+
                                   |
                                   v
+---------------------------------------------------------------------+
|                     UNIVERSAL TUTORIAL ENGINE                       |
|                                                                     |
|  +-------------------+  +-------------------+  +-----------------+  |
|  | Schema Validator   |  | Tutorial Parser   |  | State Machine   |  |
|  +-------------------+  +-------------------+  +-----------------+  |
|                                                                     |
|  +-------------------+  +-------------------+  +-----------------+  |
|  | Step Resolver      |  | Action Engine     |  | Validation      |  |
|  |                   |  |                   |  | Engine          |  |
|  +-------------------+  +-------------------+  +-----------------+  |
|                                                                     |
|  +-------------------+  +-------------------+  +-----------------+  |
|  | Event System       |  | Variable Store    |  | Progress        |  |
|  |                   |  |                   |  | Manager         |  |
|  +-------------------+  +-------------------+  +-----------------+  |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  |                     Adapter Interface                         |  |
|  +---------------------------------------------------------------+  |
+-----------------------------------+---------------------------------+
                                    │
                                    ▼
             +----------------------+----------------------+
             |                      |                      |
             v                      v                      v
+---------------------+  +---------------------+  +---------------------+
|    Chrome Adapter   |  |     Web Runtime     |  |   Desktop Adapter   |
|                     |  |        / SDK        |  |                     |
+----------+----------+  +----------+----------+  +----------+----------+
           │                        │                        │
           ▼                        ▼                        ▼
+---------------------+  +---------------------+  +---------------------+
| Chrome APIs / DOM   |  | Embedded App DOM /  |  | OS Accessibility /  |
|  (Prompt Box UI)    |  | Application State   |  | Automation APIs     |
+----------+----------+  +---------------------+  +---------------------+
           │
           │ Learner Interacts (Clicks / Typing / Navigation)
           ▼
+---------------------------------------------------------------------+
|                       STEP VALIDATION FEEDBACK LOOP                 |
|                                                                     |
|  1. Prompt / Guide Box UI  ──► Learner sees step guidance in UI     |
|  2. User Action / Event    ──► Adapter captures click/input/nav     |
|  3. Validation Engine      ──► Checks action: Success or Error?     |
|  4. State Machine (FSM)    ──► Advances to NEXT_STEP or Recovery    |
+-----------------------------------+---------------------------------+
                                    │
                                    └────► Loops back into Engine State Machine