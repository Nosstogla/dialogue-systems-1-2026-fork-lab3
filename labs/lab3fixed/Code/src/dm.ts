import { assign, createActor, setup } from "xstate";
import type { Settings } from "speechstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure";
import type { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://norwayeast.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  azureRegion: "norwayeast",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

interface GrammarEntry {
  person?: string;
  day?: string;
  time?: string;
  allDay?: boolean;
  confirm?: boolean;
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  bora: { person: "Bora Kara" },
  tal: { person: "Talha Bedir" },
  tom: { person: "Tom Södahl Bladsjö" },
  will: { person: "Will Wilson" },
  anna: { person: "Anna Andersson" },
  
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  
  "7": { time: "07:00" },
  "8": { time: "08:00" },
  "9": { time: "09:00" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12": { time: "12:00" },
  "13": { time: "13:00" },
  "14": { time: "14:00" },
  "15": { time: "15:00" },
  "16": { time: "16:00" },

  yes: { confirm: true },
  jess: { confirm: true },
  "of course": { confirm: true },
  yeah: { confirm: true },
  absolutely: { confirm: true },

  no: { confirm: false },
  "no way": { confirm: false },
  "absolutely not": { confirm: false },
};

const people = Object.values(grammar).map(g => g.person).filter(Boolean) as string[];
const peopleString = people.join(", ");

const days = Object.values(grammar).map(g => g.day).filter(Boolean) as string[];
const daysString = days.join(", ");

const times = Object.values(grammar).map(g => g.time).filter(Boolean) as string[];
const timesNumbers = times.map(t => parseInt(t.replace(":", ""),10)/100);
const minTime = Math.min(...timesNumbers);
const maxTime = Math.max(...timesNumbers);

function getPerson(utterance: string) 
{
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function getDay(utterance: string) 
{
  return (grammar[utterance.toLowerCase()] || {}).day;
}

function getTime(utterance: string) 
{
  return (grammar[utterance.toLowerCase()] || {}).time;
}


function getYesNo(utterance: string): boolean | undefined 
{
  return (grammar[utterance.toLowerCase()] || {}).confirm;
}

const dmMachine = setup
(
  {
    types: 
      {
        context: {} as DMContext,
        events: {} as DMEvents,
      },

    actions: 
      {
        "spst.speak": ({ context }, params: { utterance: string }) => context.spstRef.send
          (
            {
              type: "SPEAK",
              value: 
                {
                  utterance: params.utterance,
                },
            }
          ),

        "spst.listen": ({ context }) => context.spstRef.send
          (
            {
              type: "LISTEN",
            }
          ),
      },
  }
)

.createMachine({
  context: ({ spawn }) => 
    (
      {
        spstRef: spawn(speechstate, { input: settings }),
        lastResult: null,
        person: undefined,
        day: undefined,
        time: undefined,
        allDay: undefined,
      }
    ),
  
    id: "DM",
    initial: "Prepare",
    states: 
      {
        Prepare: 
          {
            entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
            on: { ASRTTS_READY: "WaitToStart" },
          },

        WaitToStart: 
          {
            on: 
              { 
                CLICK: "Appointment", 
              },
          },

        Appointment: 
          {
            id: "Appointment",
            initial: "Greeting",
            states: 
              {
                Greeting: 
                  {
                    id: "Greeting",
                    initial: "Prompt",
                    on: 
                      {
                        LISTEN_COMPLETE: 
                        [
                          {
                            target: "Who",
                            guard: ({ context }) => !!context.lastResult,
                            actions: assign
                              ({
                                person: undefined,
                                day: undefined,
                                time: undefined,
                                allDay: undefined,
                                confirm: undefined,
                              }), 
                          },
                          { 
                            target: "#NoInput" 
                          },
                        ],
                      },

                    states: 
                      {
                        Prompt: 
                          {
                            entry: { type: "spst.speak", params: { utterance: `Hello!` } },
                            on: { SPEAK_COMPLETE: "Ask" },
                          },

                        Ask: 
                        {
                          entry: 
                            { type: "spst.listen" },
                          on: 
                            {
                              RECOGNISED:
                                {
                                  actions: assign(({ event }) => 
                                    {
                                      return { lastResult: event.value };
                                    }),
                                },
                              ASR_NOINPUT: 
                                {
                                  actions: assign({ lastResult: null }),
                                },
                            },
                        },
                      },
                  },
                Who:
                {
                id: "Who",
                initial: "Prompt",
                on: 
                {
                  LISTEN_COMPLETE: 
                  [
                    {
                      target: "Day",
                      guard: ({ context }) => !!context.person,
                    },
                    { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.person,
                    },
                    { 
                      target: "#NoInput",
                    },
                  ],
                },
                states:
                {
                Prompt: 
                  {
                    entry: { type: "spst.speak", params: { utterance: `Who are you meeting with? Available options are ${peopleString}` } },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },

                Ask: 
                {
                  entry: 
                    { type: "spst.listen" },
                  on: 
                    {
                      RECOGNISED:
                        {
                          actions: assign(({ event }) => 
                            {
                              return { lastResult: event.value, person: event.value[0].utterance ? getPerson(event.value[0].utterance) : undefined };
                            }),
                        },
                      ASR_NOINPUT: 
                        {
                          actions: assign({ lastResult: null }),
                        },
                    },
                },
                }
                },
                Day:
                {
                id: "Day",
                initial: "Prompt",
                on: 
                {
                  LISTEN_COMPLETE: 
                  [
                    {
                      target: "WholeDay",
                      guard: ({ context }) => !!context.day,
                    },
                    { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.day,
                    },
                    { 
                      target: "#NoInput",
                    },
                  ],
                },
                states:
                {
                Prompt: 
                  {
                    entry: { type: "spst.speak", params: { utterance: `On which day is your meeting? Available options are ${daysString}` } },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },

                Ask: 
                {
                  entry: 
                    { type: "spst.listen" },
                  on: 
                    {
                      RECOGNISED:
                        {
                          actions: assign(({ event }) => 
                            {
                              return { lastResult: event.value, day: event.value[0].utterance ? getDay(event.value[0].utterance) : undefined };
                            }),
                        },
                      ASR_NOINPUT: 
                        {
                          actions: assign({ lastResult: null }),
                        },
                    },
                },
                }
                },
                WholeDay:
                {
                id: "WholeDay",
                initial: "Prompt",
                on: 
                {
                  LISTEN_COMPLETE: 
                  [
                    {
                      guard: ({ context }) => context.allDay === true,
                      target: "Create",
                    },
                    {
                      guard: ({ context }) => context.allDay === false,
                      target: "Time",
                    },
                    { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.allDay,
                    },
                    { 
                      target: "#NoInput",
                    },
                  ],
                },
                states:
                {
                Prompt: 
                  {
                    entry: { type: "spst.speak", params: { utterance: `Will it take the whole day?` } },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },

                Ask: 
                {
                  entry: 
                    { type: "spst.listen" },
                  on: 
                    {
                      RECOGNISED:
                        {
                          actions: assign(({ event }) => 
                            {
                              return { lastResult: event.value, allDay: event.value[0].utterance ? getYesNo(event.value[0].utterance) : undefined };
                            }),
                        },
                      ASR_NOINPUT: 
                        {
                          actions: assign({ lastResult: null }),
                        },
                    },
                },
                }
                },
                Time:
                {
                id: "Time",
                initial: "Prompt",
                on: 
                {
                  LISTEN_COMPLETE: 
                  [
                    {
                      guard: ({ context }) => !!context.time,
                      target: "Create",
                    },
                    { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.time,
                    },
                    { 
                      target: "#NoInput",
                    },
                  ],
                },
                states:
                {
                Prompt: 
                  {
                    entry: { type: "spst.speak", params: { utterance: `What time is your meeting? You can book between ${minTime} and ${maxTime}` } },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },
                Ask: 
                {
                  entry: 
                    { type: "spst.listen" },
                  on: 
                    {
                      RECOGNISED:
                        {
                          actions: assign(({ event }) => 
                            {
                              return { lastResult: event.value, time: event.value[0].utterance ? getTime(event.value[0].utterance) : undefined };
                            }),
                        },
                      ASR_NOINPUT: 
                        {
                          actions: assign({ lastResult: null }),
                        },
                    },
                },
                }
                },
                Create:
                {
                id: "Create",
                initial: "Prompt",
                on: 
                {
                  LISTEN_COMPLETE: 
                  [
                    {
                      guard: ({ context }) => context.confirm === true,
                      target: "Confirmation",
                    },
                    {
                      guard: ({ context }) => context.confirm === false,
                      actions: assign({
                        person: undefined,
                        day: undefined,
                        time: undefined,
                        allDay: undefined,
                        confirm: undefined,
                        lastResult: null,
                      }),
                      target: "Who",
                    },
                    { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.confirm,
                    },
                    { 
                      target: "#NoInput",
                    },
                  ],
                },
                states:
                  {
                    Prompt: 
                      {
                        entry: { type: "spst.speak", 
                          params: ({ context }) => 
                          ({
                            utterance: `Do you want me to create an appointment with ${context.person} on ${context.day} ${context.allDay ? "for the whole day" : `at ${context.time}`}. `,
                          }),
                        },
                        on: { SPEAK_COMPLETE: "Ask" },
                      },
                    Ask: 
                      {
                        entry: 
                          { type: "spst.listen" },
                        on: 
                          {
                            RECOGNISED:
                              {
                                actions: assign(({ event }) => 
                                  {
                                    return { lastResult: event.value, confirm: event.value[0].utterance ? getYesNo(event.value[0].utterance) : undefined };
                                  }),
                              },
                            ASR_NOINPUT: 
                              {
                                actions: assign({ lastResult: null }),
                              },
                          },
                      },
                  }
                },
                Confirmation:
                  {
                    id: "Confirmation",
                    entry: 
                      {
                        type: "spst.speak", 
                        params: { utterance: `Your appointment has been created` },
                      },

                    on: 
                      { SPEAK_COMPLETE: "Done" },
                  },

                Done: 
                  {
                    on: 
                      { CLICK: "#Greeting", },
                  },

                Hist: 
                {
                type: "history",
                history: "shallow",
                },
               
              },
          },

        NoInput: 
          {
            id: "NoInput",
            entry: 
              {
                type: "spst.speak",
                params: { utterance: `I can't hear you!` },
              },
            on: 
              { SPEAK_COMPLETE: "#Appointment.Hist" },
          },

        Errorhandling: 
          {
            id: "Errorhandling",
            entry: 
              {
                type: "spst.speak",
                params: ({ context }: {context: DMContext}) => 
                  ({ utterance: `You just said: ${context.lastResult![0].utterance}. And it is not an option.`,}),
              },
            on: 
              { 
                SPEAK_COMPLETE: {target: "#Appointment.Hist",},
              }
          },
      },
});


const dmActor = createActor(dmMachine, {inspect: inspector.inspect,}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) 
{
  element.textContent = "Click to start";
  
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => 
    {
      const meta: { view?: string } = Object.values(
        snapshot.context.spstRef.getSnapshot().getMeta(),
      )[0] || {
        view: undefined,
      };
      element.innerHTML = `${meta.view}`;
    });
}
