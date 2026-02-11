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
  
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  saturday: { day: "Saturday" },
  sunday: { day: "Sunday" },
  
  "07": { time: "07:00" },
  "08": { time: "08:00" },
  "09": { time: "09:00" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12": { time: "12:00" },
  "13": { time: "13:00" },
  "14": { time: "14:00" },
  "15": { time: "15:00" },
  "16": { time: "16:00" },
  "17": { time: "17:00" },
  "18": { time: "18:00" },
  "19": { time: "19:00" },
  "20": { time: "20:00" },
  "21": { time: "21:00" },
  "22": { time: "22:00" },
  "23": { time: "23:00" },

  yes: { confirm: true },
  no: { confirm: false },
};

function isInGrammar(utterance: string) 
{
  return utterance.toLowerCase() in grammar;
}

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

// function getAllDay(utterance: string): boolean | undefined 
// {
//   return (grammar[utterance.toLowerCase()] || {}).allDay;
// }

function getYesNo(utterance: string): boolean | undefined 
{
  return (grammar[utterance.toLowerCase()] || {}).confirm;
}

// const resetContext = assign({
//   person: undefined,
//   day: undefined,
//   time: undefined,
//   allDay: undefined,
//   confirm: undefined,
//   lastResult: null,
// })

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
            on: { CLICK: "Greeting" },
          },

        Greeting: 
          {
            id: "Greeting",
            initial: "Prompt",
            on: 
              {
                LISTEN_COMPLETE: 
                [
                  {
                    //target: "CheckGrammar",
                    target: "#Appointment",
                    guard: ({ context }) => !!context.lastResult,
                  },
                  { 
                    target: ".NoInput" 
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

                NoInput: 
                  {
                    entry: 
                      {
                        type: "spst.speak",
                        params: { utterance: `I can't hear you!` },
                      },
                    on: 
                      { SPEAK_COMPLETE: "Ask" },
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

        Appointment: 
          {
            id: "Appointment",
            initial: "Who",
            on: 
              {
                LISTEN_COMPLETE: 
                [
                  {
                    //target: "CheckGrammar",
                    //target: "#Appointment",
                    guard: ({ context }) => !!context.lastResult,
                  },
                  { 
                    target: "..NoInput" 
                  },
                ],
              },
            states: 
              {
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
                      target: ".Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.person,
                    },
                    { 
                      target: ".NoInput",
                    },
                  ],
                },
                states:
                {
                Prompt: 
                  {
                    entry: { type: "spst.speak", params: { utterance: `Who are you meeting with?` } },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },
                  NoInput: 
                  {
                    entry: 
                      {
                        type: "spst.speak",
                        params: { utterance: `I can't hear you!` },
                      },
                    on: 
                      { SPEAK_COMPLETE: "Ask" },
                  },
              Errorhandling: 
              {
                entry: 
                  {
                    assign: ({lastResult: null}), 
                    type: "spst.speak",
                    params: ({ context }) => 
                      ({
                        utterance: `You just said: ${context.lastResult![0].utterance}. And it 
                        is not an option.`,
                      }),
                  },

                on: 
                  { SPEAK_COMPLETE: "Prompt" },
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
                      target: ".Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.day,
                    },
                    { 
                      target: ".NoInput",
                    },
                  ],
                },
                states:
                {
                Prompt: 
                  {
                    entry: { type: "spst.speak", params: { utterance: `On which day is your meeting?` } },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },
                  NoInput: 
                  {
                    entry: 
                      {
                        type: "spst.speak",
                        params: { utterance: `I can't hear you!` },
                      },
                    on: 
                      { SPEAK_COMPLETE: "Ask" },
                  },
              Errorhandling: 
              {
                entry: 
                  {
                    assign: ({lastResult: null}), 
                    type: "spst.speak",
                    params: ({ context }) => 
                      ({
                        utterance: `You just said: ${context.lastResult![0].utterance}. And it 
                        is not an option.`,
                      }),
                  },

                on: 
                  { SPEAK_COMPLETE: "Prompt" },
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
                      target: ".Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.allDay,
                    },
                    { 
                      target: ".NoInput",
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
                  NoInput: 
                  {
                    entry: 
                      {
                        type: "spst.speak",
                        params: { utterance: `I can't hear you!` },
                      },
                    on: 
                      { SPEAK_COMPLETE: "Ask" },
                  },
              Errorhandling: 
              {
                entry: 
                  {
                    assign: ({lastResult: null}), 
                    type: "spst.speak",
                    params: ({ context }) => 
                      ({
                        utterance: `You just said: ${context.lastResult![0].utterance}. And it 
                        is not an option.`,
                      }),
                  },

                on: 
                  { SPEAK_COMPLETE: "Prompt" },
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
                      target: ".Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.time,
                    },
                    { 
                      target: ".NoInput",
                    },
                  ],
                },
                states:
                {
                Prompt: 
                  {
                    entry: { type: "spst.speak", params: { utterance: `What time is your meeting?` } },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },
                  NoInput: 
                  {
                    entry: 
                      {
                        type: "spst.speak",
                        params: { utterance: `I can't hear you!` },
                      },
                    on: 
                      { SPEAK_COMPLETE: "Ask" },
                  },
              Errorhandling: 
              {
                entry: 
                  {
                    assign: ({lastResult: null}), 
                    type: "spst.speak",
                    params: ({ context }) => 
                      ({
                        utterance: `You just said: ${context.lastResult![0].utterance}. And it 
                        is not an option.`,
                      }),
                  },

                on: 
                  { SPEAK_COMPLETE: "Prompt" },
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
                      target: ".Errorhandling",
                      guard: ({ context }) => !!context.lastResult && !context.confirm,
                    },
                    { 
                      target: ".NoInput",
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
                        utterance: `Do you want me to create and appointment with ${context.person} on ${context.day} 
                        ${context.allDay ? "for the whole day" : `at ${context.time}`}.
                        . `,
                      }),
                    },
                    on: { SPEAK_COMPLETE: "Ask" },
                  },
                  NoInput: 
                  {
                    entry: 
                      {
                        type: "spst.speak",
                        params: { utterance: `I can't hear you!` },
                      },
                    on: 
                      { SPEAK_COMPLETE: "Ask" },
                  },
              Errorhandling: 
              {
                entry: 
                  {
                    assign: ({lastResult: null}), 
                    type: "spst.speak",
                    params: ({ context }) => 
                      ({
                        utterance: `You just said: ${context.lastResult![0].utterance}. And it 
                        is not an option.`,
                      }),
                  },

                on: 
                  { SPEAK_COMPLETE: "Prompt" },
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
            // Hist: 
            // {
            // type: "history",
            // history: "deep",
            // },
            
            
            // CheckGrammar1: 
            //   {
            //     entry: 
            //       {
            //         assign: ({lastResult: null}), 
            //         type: "spst.speak",
            //         params: ({ context }) => 
            //           ({
            //             utterance: `You just said: ${context.lastResult![0].utterance}. And it 
            //             is not an option.`,
            //           }),
            //       },

            //     on: 
            //       { SPEAK_COMPLETE: "Hist" },
            //   },
                
          },
        },
        CheckGrammar: 
          {
            entry: 
              {
                type: "spst.speak",
                params: ({ context }) => 
                  ({
                    utterance: `You just said: ${context.lastResult![0].utterance}. And it 
                    ${isInGrammar(context.lastResult![0].utterance) ? "is" : "is not"} in the grammar.`,
                  }),
              },

            on: 
              { SPEAK_COMPLETE: "Done" },
          },

        Done: 
          {
            on: 
              { CLICK: "Greeting", },
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
