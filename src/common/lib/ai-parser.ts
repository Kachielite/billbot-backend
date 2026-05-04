import OpenAI from 'openai';
import { CONSTANTS } from '@/common/configuration/constants';
import logger from '@/common/lib/logger';
import { IParsedReceipt, IParsedSettlementProof } from '@/common/types/ai.types';

const openai = new OpenAI({ apiKey: CONSTANTS.OPENAI_API_KEY });

const RECEIPT_PROMPT = `You are a receipt parser. Extract the following fields from this receipt image and return valid JSON only — no markdown, no explanation, no code fences:
{
  "amount": number or null,
  "currency": "NGN" | "KES" | "GHS" | "ZAR" | null,
  "merchant": string or null,
  "description": string or null,
  "category": "rent" | "school_fees" | "food" | "transport" | "utilities" | "medical" | "other" | null,
  "date": "YYYY-MM-DD" or null
}
If a field cannot be determined from the image, return null for that field.`;

const PROOF_PROMPT = `You are a payment proof parser. This image is a screenshot of a bank transfer or mobile money confirmation. Extract the following fields and return valid JSON only — no markdown, no explanation, no code fences:
{
  "amount": number or null,
  "currency": "NGN" | "KES" | "GHS" | "ZAR" | null,
  "sender": string or null,
  "recipient": string or null,
  "reference": string or null,
  "date": "YYYY-MM-DD" or null,
  "platform": string or null
}
If a field cannot be determined from the image, return null for that field.`;

export async function parseReceipt(
  imageBuffer: Buffer,
  mimetype: string,
): Promise<IParsedReceipt | null> {
  try {
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECEIPT_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as IParsedReceipt;
  } catch (err) {
    logger.warn(`Receipt parsing failed: ${err}`);
    return null;
  }
}

const PERIOD_CONTEXT: Record<'beginning' | 'mid' | 'end', string> = {
  beginning: `It's the start of ${'{month}'} — a fresh slate! The perfect moment to set the tone and track every shared expense before things get messy.`,
  mid: `We're halfway through ${'{month}'}. Expenses have been flying around — now's the time to log them before everyone forgets who owes what.`,
  end: `${'{month}'} is almost over! Don't let shared costs slip through the cracks. Log everything now before the month closes.`,
};

export async function generateReminderMessages(
  period: 'beginning' | 'mid' | 'end',
  monthName: string,
  count = 3,
): Promise<Array<{ title: string; body: string }>> {
  const context = PERIOD_CONTEXT[period].replace(/\{month\}/g, monthName);

  const prompt = `You are the voice of BillBot — a fun, sharp, no-nonsense expense-splitting app for friend groups and colleagues across Africa. Think of your tone as that one friend who is great with money but still keeps it light.

Context: ${context}

Generate ${count} DIFFERENT push notification messages to remind {name} (use the literal placeholder "{name}" in the body so we can personalise it) to log their shared group expenses.

Return a JSON array of exactly ${count} objects, no markdown, no code fences:
[{"title":"...","body":"..."},...]

Hard rules:
- title: max 48 chars — must include at least one emoji, punchy and varied across messages
- body: max 110 chars — must include at least one emoji, address {name} naturally (not just at the start), reference the time of month
- Each message must have a DIFFERENT tone: one playful/teasing, one urgent, one motivational
- NO corporate speak. NO "please". NO "we hope you are doing well"
- Make it feel like a text from a friend, not a bank alert
- The placeholder {name} must appear exactly once in each body

Bad example (too boring): "Hey {name}, log your expenses!"
Good example: "👀 {name}, your group is watching. Who paid for what in ${monthName}? Log it before the drama starts 💸"`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');
    const parsed = JSON.parse(content) as Array<{ title: string; body: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid response shape');
    return parsed;
  } catch (err) {
    logger.warn(`Reminder message generation failed: ${err}`);
    return [
      {
        title: `💸 ${monthName} expenses — sorted?`,
        body: `{name}, your group chat is quiet but the IOUs aren't 👀 Log what you owe before ${monthName} ghosts you.`,
      },
      {
        title: `⏰ Tick tock, {name}!`,
        body: `${monthName} won't last forever. Neither will your groupmates' patience 😅 Log those expenses now!`,
      },
      {
        title: `🧾 Don't be that person, {name}`,
        body: `You know — the one who "forgets" to log expenses 😬 ${monthName} receipts don't lie. Sort it out!`,
      },
    ];
  }
}

export async function parseSettlementProof(
  imageBuffer: Buffer,
  mimetype: string,
): Promise<IParsedSettlementProof | null> {
  try {
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROOF_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as IParsedSettlementProof;
  } catch (err) {
    logger.warn(`Settlement proof parsing failed: ${err}`);
    return null;
  }
}
