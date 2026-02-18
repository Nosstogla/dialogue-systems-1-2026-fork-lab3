import { assign, createActor, setup } from "xstate";
import type { Settings } from "speechstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure";
import type { DMContext, DMEvents } from "./types";

import * as sdk from "microsoft-cognitiveservices-speech-sdk";

const speechConfig = sdk.SpeechConfig.fromSubscription(KEY, "norwayeast");

export function speakSSML(ssml: string){
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
  synthesizer.speakSsmlAsync(
    ssml,
    (result) => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        console.log("SSML successful.");
      } else {
        console.error("SSML failed. Error is:", result.errorDetails);
      }
      synthesizer.close();
    }
  );
}


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
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  bora: { person: "Bora Kara" },
  tal: { person: "Talha Bedir" },
  tom: { person: "Tom Södahl Bladsjö" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
};

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

const dmMachine = setup({
  types: {
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    "spst.speak": ({ context }, params: { utterance: string }) =>
      context.spstRef.send({
        type: "SPEAK",
        value: {
          utterance: params.utterance,
        },
      }),
    "spst.listen": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
      }),

      "azure.speakSSML": ({ self }, params: { ssml: string }) => {
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
      synthesizer.speakSsmlAsync(
        params.ssml,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            console.log("SSML successful.");
            self.send({ type: "SPEAK_COMPLETE" }); // We need to send SPEAK_COMPLETE event for speechstate
          } else {
            console.error("SSML failed. Error is:", result.errorDetails);
          }
          synthesizer.close();
        },
  );
},
  },
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
  }),
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "Greeting" },
    },
    Greeting: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "PoemStraightSSML",
            guard: ({ context }) => context.lastResult?.[0].utterance.toLowerCase() === "poem",
          },
          {
            target: "CheckGrammar",
            guard: ({ context }) => !!context.lastResult,
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `Hello world!` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't hear you!` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { lastResult: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
    },
    CheckGrammar: {
      entry: {
        type: "spst.speak",
        params: ({ context }) => ({
          utterance: `I was ${Math.round(context.lastResult![0].confidence * 100)}% sure that you just said: ${context.lastResult![0].utterance}. And it ${
            isInGrammar(context.lastResult![0].utterance) ? "is" : "is not"
          } in the grammar.`,
        }),
      },
      on: { SPEAK_COMPLETE: "Done" },
    },
    PoemStraightSSML: {
          entry: {
            type: "azure.speakSSML",
            params: {
              ssml: 
              `<speak xmlns="http://www.w3.org/2001/10/synthesis" 
                      xmlns:mstts="http://www.w3.org/2001/mstts" 
                      xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" 
                      xml:lang="en-gb">
                      <mstts:backgroundaudio src="https://raw.githubusercontent.com/Nosstogla/dialogue-systems-1-2026-fork-lab3/main/In_the_fashion-Instrumental.mp3" volume="2.0" />
                  <voice name="en-GB-AlfieNeural">
                      <break strength="strong" />
                      In The Fashion 
                      <break strength="strong" />
                      by <say-as interpret-as="characters">AA</say-as> Milne

                      <break time = "4000ms" />
                      A lion has a tail and a very fine tail 
                      <break strength="medium" />
                      And so has an elephant and so has a whale, 
                      <break strength="medium" />
                      And so has a crocodile, and so has a quail- 
                      <break strength="medium" />
                      They've all got tails but me.
                      
                      <break strength="strong" />
                      If I had sixpence I would buy one; 
                      <break strength="medium" />
                      I'd say to the shopman, 'Let me try one'; 
                      <break strength="medium" />
                      I'd say to the elephant, 'This is my one.' 
                      <break strength="medium" />
                      They'd all come round to see.

                      <break strength="strong" />
                      Then I'd say to the lion, 'Why, you've got a tail! 
                      <break strength="medium" />
                      And so has the elephant, and so has the whale! 
                      <break strength="medium" />
                      And, look! There's a crocodile! He's got a tail ! 
                      <break strength="medium" />
                      You've all got tails like me!'
                      <break time = "4000ms" />
                  </voice>
              </speak>`,
            },
          },
          on: { SPEAK_COMPLETE: "Done" },
        },
  //   withContextSSML: {
  //     entry: {
  //           type: "azure.speakSSML",
  //           params: ({ context }) => ({ ssml: ``,
  //           }),
  //     on: {
  //       on: { SPEAK_COMPLETE: "Done" },
  //     },
  //   },
  // },

    Done: {
      on: {
        CLICK: "Greeting",
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
  console.log("Confidence:", state.context.lastResult?.[0].confidence);
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta(),
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}
