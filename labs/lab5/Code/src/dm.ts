import { assign, createActor, setup } from "xstate";
import type { Settings } from "speechstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import type { DMContext, DMEvents, NLUObject } from "./types";

const inspector = createBrowserInspector();


  const azureLanguageCredentials = {
    endpoint: "https://lang-99.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview" /** your Azure CLU prediction URL */,
    key: NLU_KEY /** reference to your Azure CLU key */,
    deploymentName: "appointment" /** your Azure CLU deployment */,
    projectName: "appointment" /** your Azure CLU project name */,
  };

const azureCredentials = {
  endpoint:
    "https://switzerlandnorth.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials, /** global activation of NLU */
  azureCredentials: azureCredentials,
  azureRegion: "switzerlandnorth",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};


function getPerson(nluValue: NLUObject) 
{
  return nluValue.entities.find(e => e.category === "meeting_person")?.text;
}

function getTime(nluValue: NLUObject) 
{
  return nluValue.entities.find(e => e.category === "meeting_time")?.text;
}

function getDay(nluValue: NLUObject) 
{
  return nluValue.entities.find(e => e.category === "meeting_day")?.text;
}

function getYesNo(nluValue: NLUObject) : boolean | undefined 
{
  if(nluValue.entities.some(e => e.category === "yes") && nluValue.entities.some(e => e.category === "no")) 
    {return undefined;} 

  if(nluValue.entities.some(e => e.category === "yes")) 
    {return true;}

  if(nluValue.entities.some(e => e.category === "no")) 
    {return false;}

  return undefined;
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
              value: { nlu: true } /** Local activation of NLU */,
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
        interpretation: null,
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
                CLICK: "Greeting", 
              },
          },
                Greeting: 
                  {
                    id: "Greeting",
                    initial: "Prompt",
                      entry: assign({
                        person: undefined,
                        day: undefined,
                        time: undefined,
                        allDay: undefined,
                        confirm: undefined,
                        lastResult: null,
                        interpretation: null,
                      }),
                    on: 
                      {
                        LISTEN_COMPLETE: 
                        [
                          {
                            target: "Appointment",
                            guard: ({ context }) => context.interpretation?.topIntent === "create_meeting",

                          },
                                                    {
                            target: "WhoIs",
                            guard: ({ context }) => context.interpretation?.topIntent === "who_is_x",
                          },
                          { 
                            target: "#NoInput",
                            guard: ({ context }) =>
                              !context.lastResult || !context.interpretation, 
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
                                  actions: assign(({ event, context }) => 
                                    {

                                      return { lastResult: event.value, 
                                        interpretation: event.nluValue, 
                                        person: getPerson(event.nluValue), 
                                        day: getDay(event.nluValue), 
                                        time: getTime(event.nluValue), 
                                      allDay: context.time ?? getTime(event.nluValue) ? false : context.allDay,};
                                      
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
                  WhoIs: { 
                  id: "WhoIs",
                  initial: "Prompt",
                  states: {
                    Prompt: 
                      {
                        entry: { type: "spst.speak", 
                          params: ({ context }: { context: DMContext }) => 
                          ({
                            utterance: `${context.person} is a well known famous person `,
                          }),
                        },
                       on: 
                      { CLICK: "#Greeting", },
                      },
                  },
                  },
                  
        Appointment: 
          {
            id: "Appointment",
            initial: "Route",
            states: 
              {
                Route: {
                  always: [
                    {
                        target: "Who",
                        guard: ({ context }) => !context.person,
                      },

                      
                      {
                        target: "Day",
                        guard: ({ context }) => !context.day,
                      },

                      
                      {
                        target: "WholeDay",
                        guard: ({ context }) => context.allDay === undefined,
                      },

                      {
                        target: "Time",
                        guard: ({ context }) => context.allDay === false && !context.time,
                      },

                      {
                        target: "Create",
                        guard: ({ context }) => !!context.person && !!context.day && context.allDay !== undefined,
                      },
                  ],
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
                      target: "Route",
                      guard: ({ context }) => !!context.lastResult && !!context.person,
                    },
                    { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && context.person === undefined,
                    },
                    { 
                      target: "#NoInput",
                      guard: ({ context }) => !context.lastResult, 
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

                Ask: 
                {
                  entry: 
                    { type: "spst.listen" },
                  on: 
                    {
                      RECOGNISED:
                        {
                          actions: assign(({ event, context }) => 
                            {


                              return { 
                                
                                lastResult: event.value, 
                                interpretation: event.nluValue,
                                person: context.person ?? getPerson(event.nluValue),
                                day: context.day ?? getDay(event.nluValue),
                                time: context.time ?? getTime(event.nluValue),
                                allDay: context.time ?? getTime(event.nluValue) ? false : context.allDay,
                                };
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
                      target: "Route",
                      guard: ({ context }) => !!context.lastResult && !!context.day,
                    },
                                        { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && context.day === undefined,
                    },
                    { 
                      target: "#NoInput",
                      guard: ({ context }) => !context.lastResult, 
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

                Ask: 
                {
                  entry: 
                    { type: "spst.listen" },
                  on: 
                    {
                      RECOGNISED:
                        {
                          actions: assign(({ event, context }) => 
                            {
                              return { lastResult: event.value, 
                                interpretation: event.nluValue,
                                person: context.person ?? getPerson(event.nluValue),
                                day: context.day ?? getDay(event.nluValue),
                                time: context.time ?? getTime(event.nluValue), 
                                allDay: context.time ?? getTime(event.nluValue) ? false : context.allDay,
                               };
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
                      target: "Route",
                      guard: ({ context }) => !!context.lastResult && context.allDay !== undefined,
                    },
                                        { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && context.allDay === undefined,
                    },
                    { 
                      target: "#NoInput",
                      guard: ({ context }) => !context.lastResult, 
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
                          actions: assign(({ event, context }) => 
                            {
                              return { 
                                lastResult: event.value, 
                                interpretation: event.nluValue,
                                allDay: context.allDay ?? getYesNo(event.nluValue),
                                person: context.person ?? getPerson(event.nluValue),
                                day: context.day ?? getDay(event.nluValue),
                                time: context.time ?? getTime(event.nluValue), 
                               };
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
                      target: "Route",
                      guard: ({ context }) => !!context.lastResult && !!context.time,
                    },
                                        { 
                      target: "#Errorhandling",
                      guard: ({ context }) => !!context.lastResult && context.time === undefined,
                    },
                    { 
                      target: "#NoInput",
                      guard: ({ context }) => !context.lastResult, 
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
                Ask: 
                {
                  entry: 
                    { type: "spst.listen" },
                  on: 
                    {
                      RECOGNISED:
                        {
                          actions: assign(({ event, context }) => 
                            {
                              return { lastResult: event.value, 
                                interpretation: event.nluValue,
                                person: context.person ?? getPerson(event.nluValue),
                                day: context.day ?? getDay(event.nluValue),
                                time: context.time ?? getTime(event.nluValue),
                                allDay: context.time ?? getTime(event.nluValue) ? false : context.allDay,
                              };
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
                      guard: ({ context }) => !!context.lastResult && context.confirm === undefined,
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
                                actions: assign(({ event, context }) => 
                                  {
                                    return { lastResult: event.value, 
                                      interpretation: event.nluValue,
                                      confirm: context.confirm ?? getYesNo(event.nluValue) };
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
  console.log("State context interpretation:", state.context.interpretation);
  console.log("State context interpretation entities:", state.context.interpretation?.entities);
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

