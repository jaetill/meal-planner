/**
 * Alexa Skill Lambda — Meal Planner Cook Mode
 *
 * Setup instructions:
 * 1. Deploy this file as a Lambda function named "meal-planner-alexa"
 *    - Runtime: Node.js 20.x
 *    - Role: MealPlannerSave-role-c47ma2hi (already has S3 access)
 *    - Env var: ALEXA_USERNAME = <your cognito username>
 * 2. In Alexa Developer Console (developer.amazon.com):
 *    - Create a custom skill named "Meal Planner" (invocation: "meal planner")
 *    - Set endpoint to this Lambda ARN
 *    - Add AMAZON_ALEXA_ACCOUNT_LINKING permission if you want account linking
 *    - Under Permissions, enable "Alexa Timer API (read/write)"
 *    - Add the interaction model intents below (or paste the JSON into the skill's
 *      JSON editor under Build > Interaction Model > JSON Editor)
 *    - Save and Build the model
 * 3. To test: say "Alexa, open meal planner", then "what's next"
 *
 * Interaction model JSON (paste into JSON Editor):
 * {
 *   "interactionModel": {
 *     "languageModel": {
 *       "invocationName": "meal planner",
 *       "intents": [
 *         { "name": "WhatsNextIntent", "slots": [],
 *           "samples": ["what's next","next step","next","continue","go ahead","move on"] },
 *         { "name": "RepeatIntent", "slots": [],
 *           "samples": ["repeat","repeat that","say that again","what did you say","again"] },
 *         { "name": "CurrentStepIntent", "slots": [],
 *           "samples": ["current step","where am I","what step am I on","what are we doing"] },
 *         { "name": "AMAZON.StartOverIntent" },
 *         { "name": "AMAZON.StopIntent" },
 *         { "name": "AMAZON.CancelIntent" },
 *         { "name": "AMAZON.HelpIntent" }
 *       ]
 *     }
 *   }
 * }
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');

const BUCKET = 'jaetill-meal-planner';
const s3     = new S3Client({ region: 'us-east-2' });

// ── S3 helpers ────────────────────────────────────────────

async function s3Get(key) {
  const res  = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = await res.Body.transformToString();
  return JSON.parse(body);
}

async function s3Put(key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
}

// ── Duration helpers ──────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h && m) return `${h} hour${h > 1 ? 's' : ''} and ${m} minute${m > 1 ? 's' : ''}`;
  if (h)      return `${h} hour${h > 1 ? 's' : ''}`;
  if (m)      return `${m} minute${m > 1 ? 's' : ''}`;
  return `${s} second${s > 1 ? 's' : ''}`;
}

function isoDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}`;
}

// ── Alexa Timer API ───────────────────────────────────────

function setAlexaTimer(apiEndpoint, apiAccessToken, durationSeconds, label) {
  return new Promise(resolve => {
    const payload = JSON.stringify({
      duration:           isoDuration(durationSeconds),
      timerLabel:         label,
      creationBehavior:   { displayExactTime: true },
      triggeringBehavior: {
        operation:          { type: 'NOTIFY_ONLY' },
        notificationConfig: { playAudible: true },
      },
    });

    const url = new URL(`${apiEndpoint}/v1/alerts/timers`);
    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiAccessToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => resolve(res.statusCode >= 200 && res.statusCode < 300));

    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

// ── Response builder ──────────────────────────────────────

function respond(text, endSession = false, repromptText = null) {
  return {
    version:  '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text },
      ...(repromptText ? {
        reprompt: { outputSpeech: { type: 'PlainText', text: repromptText } },
      } : {}),
      shouldEndSession: endSession,
    },
  };
}

const REPROMPT = "Say \"what's next\" to advance, \"repeat\" to hear the step again, or \"help\" for options.";

// ── Main handler ──────────────────────────────────────────

exports.handler = async (event) => {
  const username = process.env.ALEXA_USERNAME;
  if (!username) return respond('Meal planner is not configured. Please set the Alexa username in the Lambda environment.', true);

  const requestType    = event.request?.type;
  const intentName     = event.request?.intent?.name;
  const apiEndpoint    = event.context?.System?.apiEndpoint    || 'https://api.amazonalexa.com';
  const apiAccessToken = event.context?.System?.apiAccessToken;
  const s3Key          = `cook-sessions/${username}.json`;

  // ── Launch ─────────────────────────────────────────────
  if (requestType === 'LaunchRequest') {
    try {
      const session = await s3Get(s3Key);
      const step    = session.steps[session.stepIndex];
      return respond(
        `You're cooking ${session.recipeName}. You're on step ${session.stepIndex + 1} of ${session.steps.length}: ${step.text}. ` +
        `Say "what's next" to continue.`,
        false, REPROMPT
      );
    } catch {
      return respond(
        'No active cooking session found. Open the meal planner app on your iPad and tap Cook on a recipe first.',
        true
      );
    }
  }

  if (requestType === 'SessionEndedRequest') return { version: '1.0', response: {} };
  if (requestType !== 'IntentRequest') return respond("Sorry, I didn't catch that.", false, REPROMPT);

  // ── Load session (required for all intents) ────────────
  let session;
  try {
    session = await s3Get(s3Key);
  } catch {
    return respond(
      'No active cooking session. Open the meal planner app and tap Cook on a recipe to get started.',
      true
    );
  }

  const total = session.steps.length;

  // ── Intents ────────────────────────────────────────────
  if (intentName === 'WhatsNextIntent') {
    if (session.stepIndex >= total - 1) {
      return respond(
        `You've completed all ${total} steps of ${session.recipeName}! Enjoy your meal.`,
        true
      );
    }

    session.stepIndex += 1;
    await s3Put(s3Key, session);

    const step = session.steps[session.stepIndex];
    let   text = `Step ${session.stepIndex + 1} of ${total}: ${step.text}`;

    if (step.duration && apiAccessToken) {
      const label    = `Step ${session.stepIndex + 1}`;
      const timerSet = await setAlexaTimer(apiEndpoint, apiAccessToken, step.duration, label);
      const durText  = formatDuration(step.duration);
      text += timerSet
        ? ` I've started a ${durText} timer for you.`
        : ` This step takes about ${durText}.`;
    }

    return respond(text, false, REPROMPT);
  }

  if (intentName === 'RepeatIntent' || intentName === 'AMAZON.RepeatIntent') {
    const step = session.steps[session.stepIndex];
    let   text = `Step ${session.stepIndex + 1}: ${step.text}`;
    if (step.duration) text += ` This step takes about ${formatDuration(step.duration)}.`;
    return respond(text, false, REPROMPT);
  }

  if (intentName === 'CurrentStepIntent') {
    const step = session.steps[session.stepIndex];
    let   text = `You're on step ${session.stepIndex + 1} of ${total}: ${step.text}`;
    if (step.duration) text += ` This step takes about ${formatDuration(step.duration)}.`;
    return respond(text, false, REPROMPT);
  }

  if (intentName === 'AMAZON.StartOverIntent') {
    session.stepIndex = 0;
    await s3Put(s3Key, session);
    const step = session.steps[0];
    let   text = `Starting over. Step 1 of ${total}: ${step.text}`;
    if (step.duration && apiAccessToken) {
      const timerSet = await setAlexaTimer(apiEndpoint, apiAccessToken, step.duration, 'Step 1');
      const durText  = formatDuration(step.duration);
      text += timerSet ? ` I've started a ${durText} timer.` : ` This step takes about ${durText}.`;
    }
    return respond(text, false, REPROMPT);
  }

  if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    return respond('Okay, happy cooking!', true);
  }

  if (intentName === 'AMAZON.HelpIntent') {
    return respond(
      `Here's what you can say: "what's next" to move to the next step, "repeat" to hear the current step again, ` +
      `"current step" to hear where you are, "start over" to restart from the beginning, or "stop" to exit.`,
      false, REPROMPT
    );
  }

  return respond("Sorry, I didn't understand that.", false, REPROMPT);
};
