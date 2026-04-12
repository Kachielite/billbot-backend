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
